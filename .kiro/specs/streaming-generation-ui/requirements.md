# Requirements Document

## Introduction

The TestCase Maker currently calls Claude via streaming internally (`messages.stream()`) but discards the stream — the `/api/v1/generate` endpoint waits for the full response, then returns one JSON payload. The frontend shows a "Generating… Xs" elapsed timer with no other feedback for a wait that can last 20–90 seconds.

This feature surfaces the backend's existing streaming capability to the browser. The backend exposes a new Server-Sent Events (SSE) endpoint. The frontend consumes it and renders groups and test cases as they arrive, giving the user visible, meaningful progress throughout the generation process.

---

## Glossary

- **SSE_Endpoint**: The new FastAPI endpoint at `/api/v1/generate-stream` that emits Server-Sent Events while Claude generates output.
- **SSE_Client**: The browser-side consumer that opens the SSE connection and processes incoming events.
- **Stream_Event**: A single Server-Sent Events message emitted by the SSE_Endpoint. Each event carries a `type` field and a JSON `data` payload.
- **Group_Event**: A Stream_Event of type `group` that carries one fully-assembled `Group` object (all its test cases included).
- **Progress_Event**: A Stream_Event of type `progress` that carries a human-readable status string and an optional partial token count.
- **Error_Event**: A Stream_Event of type `error` that carries an error code and message, indicating the stream has terminated abnormally.
- **Done_Event**: A Stream_Event of type `done` that carries the complete `GenerationResult` (RTM, stats, notes, warnings) and signals the stream has ended successfully.
- **Streaming_State**: The frontend UI state during an active SSE connection: one of `idle`, `connecting`, `streaming`, `done`, or `error`.
- **Partial_Result**: The incrementally assembled `GenerationResult`-shaped object that the frontend builds by accumulating Group_Events before the Done_Event arrives.
- **GenerationResult**: The complete, finalized JSON object defined in `schemas.py`, containing groups, RTM, stats, notes, and warnings.
- **Legacy_Endpoint**: The existing `POST /api/v1/generate` endpoint, unchanged by this feature.
- **Parser**: The backend component that parses Claude's raw streaming text output into structured objects.
- **Pretty_Printer**: The backend component that serialises structured objects back to JSON-compatible string form for SSE emission.

---

## Requirements

### Requirement 1: New SSE streaming endpoint

**User Story:** As a backend developer, I want a dedicated streaming endpoint, so that the frontend can consume generation progress over a persistent HTTP connection without modifying the legacy endpoint.

#### Acceptance Criteria

1. THE SSE_Endpoint SHALL accept `POST /api/v1/generate-stream` with the same `GenerateRequest` body schema as the Legacy_Endpoint; any schema mismatch between the two endpoints is a requirement violation.
2. THE SSE_Endpoint SHALL respond with `Content-Type: text/event-stream` and keep the connection open for the duration of generation.
3. THE SSE_Endpoint SHALL emit at least one Progress_Event before emitting the first Group_Event.
4. WHEN Claude produces a complete group's worth of test cases, THE SSE_Endpoint SHALL emit one Group_Event carrying the fully-assembled and server-validated `Group` object.
5. WHEN all groups have been emitted, THE SSE_Endpoint SHALL emit one Done_Event carrying the complete `GenerationResult` including RTM, stats, notes, and warnings.
6. IF generation fails at any point, THE SSE_Endpoint SHALL emit one Error_Event with the same error code and message that the Legacy_Endpoint would return, then close the connection.
7. THE SSE_Endpoint SHALL apply the same server-side validation (tidy, validate, retry logic) that the Legacy_Endpoint applies, per group, before emitting each Group_Event.
8. THE SSE_Endpoint SHALL enforce the same `requirement_text` minimum length of 40 characters that the Legacy_Endpoint enforces, returning an HTTP 400 before opening the stream if the constraint is violated.

---

### Requirement 2: Streaming parser on the backend

**User Story:** As a backend developer, I want a streaming parser that incrementally extracts complete groups from Claude's raw token stream, so that each group can be validated and emitted as soon as it is complete rather than waiting for the full response.

#### Acceptance Criteria

1. THE Parser SHALL consume Claude's raw text chunks from `messages.stream()` and accumulate them into a growing string buffer.
2. WHEN the buffer contains a complete, parseable `GroupDraft` JSON object, THE Parser SHALL extract it, apply `tidy()` and `validate()`, and yield it downstream.
3. THE Parser SHALL handle escaped characters, nested JSON objects, and multi-chunk group boundaries correctly without corrupting the accumulated buffer.
4. IF the Parser encounters a validation error for a group and a retry attempt has not yet been made, THE Parser SHALL request a correction from Claude for that specific group and emit the corrected group.
5. IF the Parser has already retried a group once and validation still fails, THE Parser SHALL emit an Error_Event and terminate the stream.
6. THE Pretty_Printer SHALL serialise each validated `Group` object to a JSON string that round-trips back to an equivalent `Group` object when parsed: `parse(pretty_print(group)) == group`.
7. FOR ALL valid `GroupDraft` objects, applying `tidy()` then `validate()` then emitting as a Group_Event SHALL produce a `Group` that is structurally equivalent to what the Legacy_Endpoint would produce for the same input.

---

### Requirement 3: Frontend SSE client

**User Story:** As a frontend developer, I want an SSE client in `api.ts`, so that the UI can consume stream events without duplicating fetch logic.

#### Acceptance Criteria

1. THE SSE_Client SHALL open an SSE connection to `/api/v1/generate-stream` using the `EventSource`-compatible `fetch` + `ReadableStream` pattern, AND THE SSE_Client SHALL send the `GenerateRequest` body as JSON regardless of whether the connection opening and body transmission complete in the same step; both conditions must hold for compliance.
2. WHEN the SSE_Client receives a Group_Event, THE SSE_Client SHALL invoke the caller-supplied `onGroup` callback with the parsed `Group` object.
3. WHEN the SSE_Client receives a Progress_Event, THE SSE_Client SHALL invoke the caller-supplied `onProgress` callback with the status string.
4. WHEN the SSE_Client receives a Done_Event, THE SSE_Client SHALL invoke the caller-supplied `onDone` callback with the complete `GenerationResult`, then close the connection.
5. WHEN the SSE_Client receives an Error_Event, THE SSE_Client SHALL invoke the caller-supplied `onError` callback with the error message, then close the connection.
6. IF the underlying network connection drops unexpectedly before a Done_Event or Error_Event is received, THE SSE_Client SHALL invoke `onError` with a connection-lost message.
7. THE SSE_Client SHALL expose an `abort()` method that cancels the in-flight stream without triggering `onError`.

---

### Requirement 4: Incremental UI rendering

**User Story:** As a tester using the tool, I want to see test case groups appear one by one as they are generated, so that I can start reviewing earlier results while the rest of the script is still being written.

#### Acceptance Criteria

1. WHEN the SSE_Client connection is established, THE UI SHALL transition from `idle` to `connecting` Streaming_State and display a "Connecting…" status indicator.
2. WHEN the first Stream_Event is received, THE UI SHALL transition to `streaming` Streaming_State.
3. WHEN a Group_Event is received, THE UI SHALL append the new group to the visible result table without removing or replacing previously rendered groups.
4. WHILE the Streaming_State is `streaming`, THE UI SHALL display the elapsed-time counter and the current progress message from the most recent Progress_Event.
5. WHEN a Done_Event is received, THE UI SHALL update the stats bar, RTM table, and notes panel with the final data from the Done_Event payload, and transition Streaming_State to `done`.
6. WHEN an Error_Event is received or the connection drops, THE UI SHALL display the error message and transition Streaming_State to `error`.
7. WHILE the Streaming_State is `streaming`, THE UI SHALL disable the "Generate test script" button and all export controls.
8. WHEN the Streaming_State transitions to `done`, THE UI SHALL enable the "Generate test script" button and all export controls.
9. THE UI SHALL unconditionally preserve all existing inline-edit, per-row-regenerate, and export functionality for groups that have already been rendered, regardless of the current Streaming_State.

---

### Requirement 5: Abort / cancel generation

**User Story:** As a tester using the tool, I want to cancel a running generation, so that I can restart with corrected input without waiting for the full 90-second timeout.

#### Acceptance Criteria

1. WHILE the Streaming_State is `connecting` or `streaming`, THE UI SHALL display a "Cancel" button adjacent to the "Generating… Xs" indicator.
2. WHEN the user activates the "Cancel" button, THE SSE_Client SHALL call its `abort()` method, and THE UI SHALL transition Streaming_State to `idle`.
3. WHEN the user activates the "Cancel" button, THE UI SHALL retain any groups that had already been rendered before cancellation, so the user can review partial results.
4. WHEN the user activates the "Cancel" button, THE UI SHALL re-enable the "Generate test script" button.
5. IF the user activates the "Cancel" button and then activates "Generate test script" again, THE UI SHALL immediately clear the previously rendered groups from the display and discard the previously accumulated Partial_Result before starting the fresh generation.

---

### Requirement 6: Backward compatibility and legacy endpoint preservation

**User Story:** As a developer maintaining the project, I want the legacy endpoint to remain unchanged, so that any existing integrations or tests that rely on `/api/v1/generate` continue to work without modification.

#### Acceptance Criteria

1. THE Legacy_Endpoint SHALL continue to accept `POST /api/v1/generate` and return a complete `GenerationResult` JSON object after full generation, unchanged.
2. THE SSE_Endpoint SHALL reuse the same `build_system()`, `build_user()`, `tidy()`, `validate()`, and `finalize()` functions from `generate.py` without duplicating that logic.
3. WHEN the same `GenerateRequest` is submitted to both the Legacy_Endpoint and the SSE_Endpoint (Done_Event payload), THE two responses SHALL be structurally equivalent (same groups, same stats shape, same notes structure), differing only in `generation_id` and `created_at`.
4. THE existing frontend `generate()` function in `api.ts` SHALL remain in place and unchanged, so the legacy code path can be restored by a one-line change.

---

### Requirement 7: Session state persistence with streaming results

**User Story:** As a tester using the tool, I want the streamed result to persist in the browser session the same way the legacy result does, so that a page refresh restores the last completed generation.

#### Acceptance Criteria

1. WHEN a Done_Event is received and the Streaming_State transitions to `done`, THE UI SHALL write the complete `GenerationResult` from the Done_Event to `sessionStorage` under the same key (`testcase-maker:v1`) used by the legacy flow.
2. WHEN a generation is cancelled before a Done_Event arrives, THE UI SHALL NOT overwrite the previously saved `sessionStorage` entry.
3. WHEN the page is reloaded after a completed streaming generation, THE UI SHALL restore and display the complete `GenerationResult` exactly as it does today for legacy results.
