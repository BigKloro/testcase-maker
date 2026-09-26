# TestCase Maker

**AI-powered SIT/UAT test case generator.** Paste a requirement, get a grouped test script plus a matching RTM, review and edit it in the browser, export the four-sheet workbook a tester pastes straight into the project script.

Built against the real SIT template used on a PEGA core banking delivery project at an Indonesian bank. The schema is a one-to-one model of that workbook, not a generic test case table.

> Framing: **first draft in under a minute, you review.** The tool does transcription and systematic case derivation. It does not replace the QA engineer, and it does not know your domain rules.

---

## What it does

1. You paste acceptance criteria, name the system under test (PEGA, T24, CardPerfect, Web App, REST API), set the TC ID prefix and language.
2. One Claude call with a schema-constrained output returns acceptance criteria, functional groups, and cases classified positive / negative / boundary.
3. The server renumbers, orders positives first, maps the internal class onto the template's two-value Pos/Neg column, derives the RTM from the groups, and computes coverage stats.
4. You edit inline, add, duplicate, delete or reorder cases, and regenerate a single case with the rest of the script as context. Every edit can be undone (Ctrl+Z).
5. You export: XLSX with RTM, Test Script, Defect List and Note sheets, or a flat CSV of the Test Script sheet.

Coverage is reported, not assumed. Any acceptance criterion that produced no case is surfaced as a warning in the UI. Assumptions the model had to make land on the Note sheet as questions for the BA.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic |
| Generation | Claude API, structured output, `claude-opus-5` by default |
| Frontend | React 19, Vite 7, Tailwind 4, TypeScript |
| Export | openpyxl |
| State | Browser `localStorage` only (survives closing the tab, cleared with "New script"). No database, no auth. |
| Deploy | Hetzner VPS, PM2 + nginx |

One Pydantic definition per concept serves as the API contract, the LLM output schema, and the export validator.

---

## Run it locally

**Windows, one step:** double-click `run.bat`. First run creates the backend virtualenv, installs both sides, and opens two terminal windows plus the browser at http://127.0.0.1:5173. Without an `ANTHROPIC_API_KEY` in `backend/.env` it starts in demo mode automatically. `stop.bat` shuts both servers down.

Manual setup, or macOS/Linux:

```bash
# backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env               # put your ANTHROPIC_API_KEY in it
python -m uvicorn app.main:app --port 8010 --reload
```

```bash
# frontend, second terminal
cd frontend
npm install
npm run dev                        # http://127.0.0.1:5173, proxies /api to 8010
```

Without an API key, set `TESTCASE_MAKER_MOCK=1` to serve a fixture instead of calling Claude. Enough to develop and demo the UI, export, and editing flow. It is not a quality signal.

Self-check, no API key needed. Covers validation rules, ID/RTM/stats derivation, and both exports:

```bash
python backend/tests/test_pipeline.py
```

---

## API

Three endpoints, JSON in and out, no auth.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/generate` | Requirement in, `GenerationResult` out |
| `POST` | `/api/v1/regenerate-case` | One `tc_id` plus the current script, one replacement `TestCase` out |
| `POST` | `/api/v1/export` | Reviewed `GenerationResult` in, XLSX or CSV out |
| `GET` | `/api/v1/jira?key=…` | Ticket key or browse URL in, prefilled requirement out. 501 unless configured |
| `GET` | `/api/v1/health` | Model, effort, mock flag, whether Jira is configured |

Interactive docs at `/api/docs`. Errors come back as `{"error": {"code", "message", "details"}}` with codes `requirement_too_short`, `invalid_request`, `schema_validation_failed`, `llm_timeout`, `llm_rate_limited`, `llm_error`, `case_not_found`, `export_failed`.

```bash
curl -X POST http://127.0.0.1:8010/api/v1/generate \
  -H "Content-Type: application/json" \
  -d @request.json
```

---

## Pulling from Jira

Optional, and **off unless credentials are present**. Set three variables in `backend/.env`:

```bash
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=            # id.atlassian.com -> Security -> API tokens
```

With those set, a Fetch from Jira box appears next to the sample buttons. Give it a ticket key or paste a browse URL; it fills the story key, title, URL and requirement text in one step. Authentication is Basic auth with a personal API token, read-only, scoped to whatever that account can already see.

**Leave these unset on any public instance.** Without them the health check reports `jira: false`, the control never renders, and the endpoint returns 501. That is deliberate: it keeps real client ticket text off a public box, and it is the configuration the deploy ships with.

Two limits worth knowing before you trust a fetch:

- **Screenshots do not come across.** Jira embeds them as blob references that cannot be retrieved, so the fetch counts them and warns you. On the ticket this tool was modelled on, the modal title, its six fields, and the `Submit` and `Cancel` buttons existed *only* in screenshots. Open the ticket and read them.
- **Only summary and description are pulled.** Not comments, not attachments, not linked pages or spreadsheets.

## How quality is enforced

The prompt carries the style rules. The server checks them and, on failure, sends the violations back to the model once before giving up with `schema_validation_failed`.

| Field | Rule | On violation |
|---|---|---|
| `title` | Positive starts with `Memastikan` (id) or `Verify` (en). Negative and boundary describe the invalid action directly. No trailing period. | error, retry once |
| `test_steps[0]` | Login or entry point for the named system | error, retry once |
| `expected_result` | Specific and verifiable. Bare `berhasil` / `sukses` / `success` rejected. | error, retry once |
| `requirement_ref` | Exactly one AC id | error, retry once |
| `test_steps[n]` | One action, under 200 characters, no chained clause | warning, surfaced in the UI |
| `case_class` | Each group reaches at least one negative or boundary case | warning, surfaced in the UI |
| `status`, `tested_by`, `execution_date`, `notes` | Always empty on generate | forced server-side, model output ignored |

TC IDs, group numbering, Pos/Neg mapping and the RTM are all derived server-side, never taken from the model. The same derivation runs in the browser after every edit, so the RTM cannot drift from the script.

Boundary cases export as `Negative`, because the real template has no third column and inventing one would break the paste-in. They stay visible in the UI and in the coverage stats.

---

## Deploy to the VPS

Everything is in `deploy/`. The API binds to `127.0.0.1:8010`, so UFW needs nothing beyond the `Nginx Full` rule the box already has.

```bash
# once
git clone <repo> /var/www/testcase-maker
cd /var/www/testcase-maker
cp backend/.env.example backend/.env && $EDITOR backend/.env
sudo cp deploy/nginx.testcase-maker.conf /etc/nginx/sites-available/testcase-maker
sudo ln -s /etc/nginx/sites-available/testcase-maker /etc/nginx/sites-enabled/
# edit server_name first, then:
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d testcase.example.com
```

```bash
# every deploy
deploy/deploy.sh
```

`deploy.sh` pulls, installs both sides, runs the self-check, builds the frontend, and reloads PM2. The nginx config rate-limits the two endpoints that spend Claude tokens to six per minute per IP with a burst of four, and allows a 600 second read timeout on them because a large story can take a while.

---

## Where this breaks

Naming the limits is the point, so:

- **Vague acceptance criteria produce vague cases.** "The system should handle errors gracefully" yields a case that says roughly that. The tool cannot invent the error catalogue.
- **Domain rules that are not in the text are invisible to it.** Interest matrices, product eligibility, regulatory limits. If the AC does not state the rule, the model either omits it or assumes something and flags it.
- **UI labels, table names, column names and endpoints can be hallucinated.** The prompt forbids inventing them and requires an assumption note instead, but the failure mode to watch for is a confident wrong table name. Always read the Note sheet.
- **Very long requirements degrade.** Past roughly twenty acceptance criteria the grouping gets coarse. Split the story.
- **Boundary coverage is the weakest class.** It is the one the model most often keeps generic rather than deriving from actual stated limits.
- **A Jira fetch silently loses the screenshots.** The text arrives, the images do not, and on image-heavy tickets that is where the exact labels live. The warning exists because this failure is invisible otherwise.
- **No execution tracking and no persistence.** Out of scope by design. The Defect List sheet exports empty on purpose.
- **Not multi-tenant, no auth.** Anyone with the URL can spend your API tokens, hence the nginx rate limit. Do not paste real client requirements into a public instance.

---

## Verification status

Honest about what has and has not been measured.

| Check | Status |
|---|---|
| Backend pipeline: validation rules, ID/RTM/stats derivation, XLSX and CSV export | Passing, `backend/tests/test_pipeline.py` |
| Jira key parsing, ADF flattening, and the credentials-absent default | Passing, same file, no network |
| Jira fetch end to end: bare key, pasted browse URL, 404, 400, 501, warning shown in the UI | Verified against a local stub serving a real-shaped payload |
| Jira fetch against live Atlassian | Not yet run. Needs an API token; the connector proved the account and scope work, the app's own call path did not. |
| All three endpoints over HTTP, plus error envelopes | Verified by curl against a running server |
| Full browser flow: generate, inline edit, add/duplicate/delete/reorder, undo/redo, filters, regenerate, coverage jump, both exports, persistence, dark mode, 390px mobile | Verified headless (Playwright), no console errors |
| Export opens with correct sheets, headers, formulas and merges | Verified by reading the generated workbook back |
| **Generation quality against real Claude** | **Not yet run.** Needs an `ANTHROPIC_API_KEY`. Everything above was exercised against the fixture in mock mode. |
| Style fidelity diff against the hand-written script | Not yet run. Blocked on the same thing. |
| Timed manual-versus-generated baseline | Not yet run. Blocked on the same thing. |

The three unrun checks are the ones that prove the product rather than the plumbing. Run them first with a real key.

---

## Decisions made beyond the PRD

The PRD left these open. Each was decided one way; each is cheap to change.

**Schema**

- `acceptance_criteria` was added to `GenerationResult`. The PRD reported `ac_total` and `ac_uncovered` in stats but never returned the AC text, so a coverage warning naming `AC-5` was unreadable. The model now emits the extracted list and the UI renders it.
- `requirement_ref` holds exactly one AC id. A case citing two criteria was ambiguous for coverage accounting, so multi-references are trimmed to the first and validated.
- `req_prefix` constrains to `^TC-\d{2}$`, and the second group becomes `TC-02`, the third `TC-03`, and so on. The PRD gave `TC-01` as the first group's `req_no` but never said how later groups are numbered.
- `Story.story_key` and its siblings are nullable throughout. The PRD's sample always had them; a pasted requirement with no ticket is a normal case.
- `CaseDraft`, what the model writes, is separate from `TestCase`, what the API returns. The model never sees or writes `tc_id`, `pos_neg`, or the four execution columns.

**API contract**

- `/api/v1/regenerate-case` takes `{tc_id, requirement_text, instruction, result}`. The PRD said "one tc_id plus the current script" without fixing the shape. `instruction` is an optional free-text steer from the reviewer.
- The export filename comes from the story key: `DEMO-5385_test_script.xlsx`. Falls back to `test-script` with no key.
- `GET /api/v1/health` was added for PM2 and the deploy script, and now also tells the UI whether to show the Jira control.
- The Jira key is a **query parameter**, not a path segment. A pasted browse URL encodes its slashes to `%2F` and never matches a path route, which returned a bare 404 before the endpoint was reshaped.
- The Jira fetch does not try to slice the acceptance-criteria section out of the description. The prompt's first instruction is already to extract atomic criteria from whatever it is given, so the whole description is handed over and no fragile heading matching is needed.
- Unknown ADF node types recurse into their children rather than being skipped, so an unfamiliar Jira macro degrades to its text instead of disappearing.
- Request validation errors return HTTP 422 with code `invalid_request`; the PRD only specified the `schema_validation_failed` body.
- One retry on validation failure, as specified, then a hard 422. No third attempt.

**Generation**

- Model defaults to `claude-opus-5` at effort `high`, both overridable by environment variable. The PRD's sample response named a model that no longer exists.
- Structured output rather than tool use. Same schema guarantee, less ceremony.
- The system prompt is cached, so reruns on the same settings pay roughly a tenth for the prefix.
- Streaming is used internally to avoid HTTP timeouts on large scripts, but the endpoint returns one JSON response. The PRD's flow mentioned cases streaming into the UI; that is a v2 change touching both sides.
- Requirements under 40 characters are rejected before a call is made.

**UI**

- One page, no router. Session storage keeps form, result and export metadata across a reload; nothing is sent anywhere else.
- Class is edited as `positive` / `negative` / `boundary`, and Pos/Neg is shown read-only beneath it, derived. Editing the exported value directly would let the two disagree.
- Test steps are edited as one numbered textarea and parsed back into the array on change. A per-step row editor was more UI than the job needs.
- Every edit re-runs the full derivation in the browser: renumbering, Pos/Neg, RTM totals, coverage stats. Delete a case and the IDs below it close up immediately.
- Delete happens immediately with an Undo toast instead of a confirm dialog; the whole script has an undo/redo history (50 steps, typing in one cell collapses into one step). Regenerate opens a modal with an optional instruction and quick presets.
- Results are split into tabs: Script (summary cards, filterable table), Coverage (each AC with the cases citing it, click to jump), Notes (BA questions, editable), Export. Light, dark and system themes.
- Groups can be relabelled and cases reordered within a group. Moving a case between groups, adding a blank case, and reordering groups are not implemented.
- Export metadata (project name, number, created by) lives in the export panel rather than the input form, since it is only needed at the end.
- The demo warning about real client requirements is always visible.
- Laptop-first. It does not break on a phone, but the table scrolls horizontally there, as permitted by the PRD's scope note.
