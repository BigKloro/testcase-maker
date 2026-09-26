# PRD: TestCase Maker

**AI-powered SIT/UAT test case generator**
Author: Darrent Matthew Chandra
Status: Draft v1.1 (portfolio project)
Date: 13 September 2026

Schema and export layout in this document are derived from real SIT scripts the author produced on a PEGA core banking delivery project at an Indonesian bank. The tool is built to reproduce that exact artifact, not a generic test case table.

---

## 1. Problem Statement

On SIT/UAT projects in banking, ERP, and fintech delivery, test case writing is still manual. A QA engineer or BA reads a requirement or Jira story, then hand-types 10 to 60 rows into a test script workbook: TC ID, title, positive/negative, priority, type, precondition, numbered steps, expected result, and blank execution columns. On top of that sits an RTM that has to stay in sync with the script, group by group.

Four things go wrong consistently:

- **It is slow.** A mid-size story costs 1 to 3 hours of typing before a single case is executed. A 62-case script is most of a day.
- **Coverage is uneven.** Positive paths get written first and thoroughly. Negative and boundary cases get written last, under deadline, and get thin.
- **Format drifts.** One tester writes "berhasil", another writes a specific verifiable expected result quoting the exact UI label. Reviewers then spend time fixing style instead of logic.
- **The RTM decays.** Req rows, case counts, and group labels are maintained by hand and drift from the script within days.

The requirement text already contains most of what a test case needs. The gap is transcription, systematic case derivation, and keeping the RTM consistent with the script. All three are mechanical.

## 2. Goals and Non-Goals

### Goals

1. Turn one requirement, user story, or pasted acceptance criteria into a complete, grouped test script in under 60 seconds.
2. Output that matches a real SIT script template column for column, so a tester pastes it in with zero structural rework.
3. Force systematic coverage: positive, negative, and boundary cases derived per acceptance criterion, grouped by functional flow.
4. Generate the RTM from the same structure, so script and RTM cannot disagree.
5. Surface the model's assumptions and the AC ambiguities it hit, instead of silently guessing.
6. Produce an editable result. The human reviews and fixes before export, never blind-trusts the model.

### Non-Goals

- Not a test management system. No execution tracking, no run history, no defect workflow.
- Not a test automation tool. It writes cases for humans to execute, it does not generate Selenium or Playwright scripts.
- Not multi-tenant. Single user, no auth, no org model.
- Not trying to replace the QA engineer. The framing throughout the UI is "first draft in 30 seconds, you review", not "AI writes your test cases".

## 3. Target User and Use Case

**Primary user:** QA engineer or business analyst on an SIT/UAT project who currently writes test scripts manually in Excel or Google Sheets.

**Primary use case:**
A story is assigned for SIT. The tester pastes the acceptance criteria, names the system under test (PEGA, T24, CardPerfect, a web app, an API), sets the TC ID prefix, and gets a grouped test script plus a matching RTM. They edit what is wrong, delete what is redundant, export the workbook, and paste it into the project script.

**Secondary use case:**
A BA writing UAT scenarios for business users, where cases need to read in Indonesian and in business language rather than system language.

## 4. MVP Feature List

Scoped to build in a long weekend to a week, solo.

| # | Feature | Notes |
|---|---|---|
| 1 | Requirement input | Textarea for pasted AC. Context fields: story key, story title, system under test, output language (ID/EN), TC ID prefix, target case count, default priority and type. |
| 2 | LLM generation | Backend calls Claude with a schema-constrained tool definition. Returns typed JSON, never free text. Prompt carries the style rules (title conventions, step conventions, expected result conventions). |
| 3 | Grouping | Cases are emitted inside functional groups, positive cases before negative within each group. Groups become the header rows in the sheet and the rows of the RTM. |
| 4 | Coverage classes | Every case carries an internal class of `positive`, `negative`, or `boundary`. The sheet exports only Positive/Negative (matching the real template), the class drives the coverage stats. |
| 5 | AC traceability | Each case records which AC line it came from. Any AC that produced no case is reported as uncovered. |
| 6 | Assumptions output | Model emits assumptions it had to make, corrections where AC text conflicts with itself, and ambiguities to confirm with the BA. These land on the Note sheet. |
| 7 | Result table | Editable table in the UI. Inline edit of any field, delete row, reorder, per-row regenerate with the rest of the script as context. |
| 8 | RTM generation | Derived from groups, not written separately. Req No, Requirement label, Total Case, and zeroed Passed/Failed/Not Tested counters. |
| 9 | Export | Four-sheet XLSX matching the template: RTM, Test Script, Defect List, Note. Plus flat CSV of the Test Script sheet for quick pasting. |

That is the whole MVP. One screen, one generate call, one export.

**Built-in style profile.** The MVP ships one profile: the bank SIT template documented in section 7. It is a real template from a real delivery project, which is the point. Profile selection is a v2 concern.

## 5. Stretch / v2 Features

Listed to show product thinking, built only if time allows.

- **Jira integration.** Paste a ticket key or URL, pull description and AC via the Jira API instead of copy-paste.
- **Style profile from upload.** Upload an existing test script, infer column order and writing style, match it. Highest real-world value, because every client has its own template.
- **Gap analysis mode.** Upload an existing script plus the requirement, report which AC have no coverage. Mirrors RTM gap analysis on a live SIT project.
- **Deduplication across stories.** When two stories overlap, detect duplicate and superseded cases and report which story should own each. The real-world version of this deleted 49 of 115 draft cases on one project.
- **Multi-story bulk mode.** Several stories in, one workbook out with a consistent ID series.
- **Test data suggestions.** Per case, concrete input values (boundary amounts, invalid account formats, expired dates).
- **Live execution counters.** Paste back an executed script, recompute RTM Passed/Failed/Not Tested and completeness bars.

## 6. Core User Flow

```
1. Land on single page. Paste a requirement, or click a sample.
2. Set context: story key, system under test, language, TC ID prefix, case count target.
3. Click Generate.
4. Cases stream in, grouped, positive before negative within each group.
5. Review. Edit cells inline. Delete weak cases. Regenerate individual rows.
6. Read the Assumptions panel. These are the questions to take back to the BA.
7. Click Export. XLSX (4 sheets) or CSV (Test Script only).
8. Paste into the project script.
```

No login, no save, no project list. State lives in the browser session. Deliberate, and stated in the README: it keeps the demo instant for anyone who opens the link.

## 7. Output Schema

The schema is the credibility centre of this project. It is a one-to-one model of the real workbook.

### 7.1 Workbook layout (export target)

| Sheet | Contents |
|---|---|
| `RTM` | Project header block (Project Name, Project No, Created By), status summary block (Total Case, Passed, Failed, Not Tested, Defect + percentages), then the traceability table: Req No, Requirement, Total Case, Passed, Failed, Not Tested, Completeness. |
| `Test Script` | The 12 columns below, with story header rows and group header rows interleaved. |
| `Defect List` | Headers only, zeroed counters. Filled during execution, not by the tool. |
| `Note` | Source story links, corrections against the AC text, assumptions to confirm, dedup reasoning. |

### 7.2 Test Script sheet columns and row types

Columns, in order: `TC ID`, `Title / Description`, `Pos/Neg`, `Priority`, `Type`, `Precondition`, `Test Steps`, `Expected Result`, `Status`, `Tested By`, `Execution Date`, `Notes`.

Three row types:

1. **Story header row** (column A only): `DEMO-5385 | Pega Micro - Mapping Bunga Graduasi (Solusi Sementara SIKP)`
2. **Group header row** (column A only): `-- Group 1: Tombol 'Cek Limit dan Akad SIKP' dan Validasi Tombol 'Hitung Angsuran' --`
3. **Case row**: all 12 columns, last four blank.

`Test Steps` is stored as an array and rendered on export as a newline-separated numbered list inside one cell (`1. Login PEGA menggunakan akun MSO\n2. Buka pengajuan KUR di Step 1\n...`).

### 7.3 JSON schema

Types given in TypeScript notation. This is also the Pydantic model on the backend and the tool input schema handed to Claude, defined once.

```typescript
type Language   = "id" | "en";
type PosNeg     = "Positive" | "Negative";
type CaseClass  = "positive" | "negative" | "boundary";
type Priority   = "High" | "Medium" | "Low";
type TestType   = "Functional" | "Non-Functional" | "Regression" | "Integration";
type ExecStatus = "" | "Passed" | "Failed" | "Not Tested" | "On Hold" | "Defect";

interface TestCase {
  tc_id:            string;      // "TC-01-07", pattern ^TC-\d{2}-\d{2}$
  title:            string;      // -> "Title / Description"
  pos_neg:          PosNeg;      // exported column
  case_class:       CaseClass;   // internal, drives coverage stats, not exported
  priority:         Priority;
  type:             TestType;
  precondition:     string;      // "" when none
  test_steps:       string[];    // 1 action per element, min 1, step[0] = login/entry point
  expected_result:  string;      // specific and verifiable, quotes exact UI labels
  requirement_ref:  string;      // "AC-3", internal traceability, not exported
  status:           ExecStatus;  // always "" on generate
  tested_by:        string;      // always ""
  execution_date:   string|null; // always null on generate, ISO date once executed
  notes:            string;      // always ""
}

interface Group {
  group_no:    number;     // 1-based, within the story
  group_label: string;     // "Tombol 'Cek Limit dan Akad SIKP' dan Validasi Tombol 'Hitung Angsuran'"
  req_no:      string;     // "TC-01", the RTM key for this group
  test_cases:  TestCase[]; // positive cases first, then negative
}

interface Story {
  story_key:   string;       // "DEMO-5385"
  story_title: string;       // "Pega Micro - Mapping Bunga Graduasi (Solusi Sementara SIKP)"
  story_url:   string|null;  // Jira URL, goes on the Note sheet
}

interface RtmRow {
  req_no:       string;   // "TC-01"
  requirement:  string;   // "DEMO-5385 | Group 1: Tombol 'Cek Limit dan Akad SIKP' ..."
  total_case:   number;
  passed:       number;   // 0 on generate
  failed:       number;   // 0 on generate
  not_tested:   number;   // == total_case on generate
  completeness: number;   // 0.0 to 1.0, rendered as the bar in the sheet
}

interface Note {
  kind:   "source" | "correction" | "assumption" | "dedup";
  label:  string;   // "Label tombol", "Asumsi 1", "Ringkasan"
  detail: string;
}

interface Stats {
  total_cases:    number;
  by_class:       { positive: number; negative: number; boundary: number };
  by_priority:    { High: number; Medium: number; Low: number };
  ac_total:       number;
  ac_covered:     number;
  ac_uncovered:   string[];  // ["AC-5"] -> surfaced in the UI as a coverage warning
}

interface GenerationResult {
  generation_id: string;    // "gen_01JB7K2P9X"
  created_at:    string;    // ISO 8601 UTC
  model:         string;
  language:      Language;
  system_under_test: string;
  story:         Story;
  groups:        Group[];
  rtm:           RtmRow[];
  notes:         Note[];
  stats:         Stats;
  warnings:      string[];  // non-fatal, e.g. "AC-5 produced no test case"
}
```

### 7.4 Content rules enforced in the prompt and validated server-side

| Field | Rule | Validation |
|---|---|---|
| `tc_id` | `TC-{req_seq}-{case_seq}`, sequential and unique | regex + uniqueness check, renumbered server-side if the model drifts |
| `title` | Positive starts with `Memastikan ...` (ID) or `Verify ...` (EN). Negative describes the invalid action directly, no `Memastikan`. No trailing period. | prefix check by `pos_neg`, reject and retry once |
| `test_steps[0]` | Login or entry point for the named system (`Login PEGA menggunakan akun MSO`, `Login T24`, `Kirim request POST ke endpoint /x`) | non-empty + entry-point keyword check |
| `test_steps[n]` | One action, imperative (`Buka`, `Klik`, `Pilih`, `Cek`, `Isi`, `Query`, `Submit`). No explanation, no hedging. | max length, no conjunction "dan kemudian" |
| `expected_result` | Specific and verifiable. Bare `berhasil` / `sukses` / `success` rejected. Exact UI labels in single quotes. | denylist check, min length |
| `precondition` | System state, data state, role availability. `""` only when genuinely none. | none |
| `status`, `tested_by`, `execution_date`, `notes` | Always empty on generate | forced empty server-side regardless of model output |
| `case_class` | Every group should reach at least one negative or boundary case | warning if a group is all-positive |

`case_class` mapping on export: `positive` writes `Positive`, both `negative` and `boundary` write `Negative`. The real template has no third column, and inventing one would break the paste-in. Boundary cases stay visible in the UI and in the stats.

## 8. API Contract

Three endpoints. FastAPI, JSON in and out, no auth in MVP.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/generate` | Requirement in, `GenerationResult` out |
| `POST` | `/api/v1/regenerate-case` | One `tc_id` plus the current script, one replacement `TestCase` out |
| `POST` | `/api/v1/export` | Reviewed `GenerationResult` in, XLSX or CSV out |

### 8.1 Request schema

```typescript
interface GenerateRequest {
  requirement_text:   string;   // required, the pasted AC, 1 to 20000 chars
  system_under_test:  string;   // required, "PEGA", "T24", "CardPerfect", "Web App", "REST API"
  story_key:          string|null;
  story_title:        string|null;
  story_url:          string|null;
  language:           Language;       // default "id"
  req_prefix:         string;         // default "TC-01", first group's req_no
  target_case_count:  number|null;    // soft target, null = model decides
  default_priority:   Priority;       // default "High"
  default_type:       TestType;       // default "Functional"
  include_rtm:        boolean;        // default true
}
```

### 8.2 Sample request

```http
POST /api/v1/generate
Content-Type: application/json
```

```json
{
  "requirement_text": "Tambahkan tombol 'Cek Limit dan Akad SIKP' pada Step 1 halaman Initial Application Terms untuk pengajuan produk KUR. Tombol mengirim parameter Nik, Skema, dan Sektor. Jika response Code = '00', tampilkan modal 'get_limit_sikp' dan aktifkan tombol 'Hitung Angsuran'. Jika Code != '00', tampilkan modal error. Response disimpan ke tabel trx_sikp_response dengan CreatedBy = 'Response_Cek_Limit_Dan_Akad'. Tombol tidak berlaku untuk produk KUK.",
  "system_under_test": "PEGA",
  "story_key": "DEMO-5385",
  "story_title": "Pega Micro - Mapping Bunga Graduasi (Solusi Sementara SIKP)",
  "story_url": "https://example.atlassian.net/browse/DEMO-5385",
  "language": "id",
  "req_prefix": "TC-01",
  "target_case_count": 9,
  "default_priority": "High",
  "default_type": "Functional",
  "include_rtm": true
}
```

### 8.3 Sample response

`200 OK`. Truncated to three of nine cases for readability, the shape is complete.

```json
{
  "generation_id": "gen_01JB7K2P9XQ4M",
  "created_at": "2026-09-13T08:41:12Z",
  "model": "claude-sonnet-4-6",
  "language": "id",
  "system_under_test": "PEGA",
  "story": {
    "story_key": "DEMO-5385",
    "story_title": "Pega Micro - Mapping Bunga Graduasi (Solusi Sementara SIKP)",
    "story_url": "https://example.atlassian.net/browse/DEMO-5385"
  },
  "groups": [
    {
      "group_no": 1,
      "req_no": "TC-01",
      "group_label": "Tombol 'Cek Limit dan Akad SIKP' dan Validasi Tombol 'Hitung Angsuran'",
      "test_cases": [
        {
          "tc_id": "TC-01-01",
          "title": "Memastikan tombol 'Cek Limit dan Akad SIKP' tampil di Step 1 halaman Initial Application Terms pada pengajuan KUR",
          "pos_neg": "Positive",
          "case_class": "positive",
          "priority": "High",
          "type": "Functional",
          "precondition": "Tersedia pengajuan produk KUR aktif di Step 1 - MSO; kolom 'Sektor Ekonomi' pada halaman Occupation Data - Applicant sudah terisi",
          "test_steps": [
            "Login PEGA menggunakan akun MSO",
            "Buka pengajuan KUR di Step 1",
            "Buka halaman Initial Application Terms",
            "Cek keberadaan tombol 'Cek Limit dan Akad SIKP'"
          ],
          "expected_result": "Tombol dengan label 'Cek Limit dan Akad SIKP' tampil di Step 1 pada halaman Initial Application Terms",
          "requirement_ref": "AC-1",
          "status": "",
          "tested_by": "",
          "execution_date": null,
          "notes": ""
        },
        {
          "tc_id": "TC-01-04",
          "title": "Memastikan response tersimpan di tabel trx_sikp_response dengan kolom 'CreatedBy' bernilai 'Response_Cek_Limit_Dan_Akad'",
          "pos_neg": "Positive",
          "case_class": "positive",
          "priority": "High",
          "type": "Functional",
          "precondition": "Tersedia akses query ke tabel trx_sikp_response; tersedia pengajuan produk KUR aktif di Step 1 - MSO",
          "test_steps": [
            "Login PEGA menggunakan akun MSO",
            "Buka pengajuan KUR di Step 1",
            "Buka halaman Initial Application Terms",
            "Klik tombol 'Cek Limit dan Akad SIKP'",
            "Query tabel trx_sikp_response berdasarkan nomor pengajuan"
          ],
          "expected_result": "Terdapat 1 record baru pada tabel trx_sikp_response dengan kolom 'CreatedBy' bernilai 'Response_Cek_Limit_Dan_Akad'",
          "requirement_ref": "AC-5",
          "status": "",
          "tested_by": "",
          "execution_date": null,
          "notes": ""
        },
        {
          "tc_id": "TC-01-07",
          "title": "Klik tombol 'Hitung Angsuran' sebelum tombol 'Cek Limit dan Akad SIKP' diklik",
          "pos_neg": "Negative",
          "case_class": "negative",
          "priority": "High",
          "type": "Functional",
          "precondition": "Tersedia pengajuan produk KUR aktif di Step 1 - MSO yang belum pernah melakukan hit 'Cek Limit dan Akad SIKP'",
          "test_steps": [
            "Login PEGA menggunakan akun MSO",
            "Buka pengajuan KUR di Step 1",
            "Buka halaman Initial Application Terms",
            "Klik tombol 'Hitung Angsuran' tanpa menekan tombol 'Cek Limit dan Akad SIKP'"
          ],
          "expected_result": "Tombol 'Hitung Angsuran' tidak menyala atau tidak dapat digunakan sehingga proses hitung angsuran tidak berjalan",
          "requirement_ref": "AC-3",
          "status": "",
          "tested_by": "",
          "execution_date": null,
          "notes": ""
        }
      ]
    }
  ],
  "rtm": [
    {
      "req_no": "TC-01",
      "requirement": "DEMO-5385 | Group 1: Tombol 'Cek Limit dan Akad SIKP' dan Validasi Tombol 'Hitung Angsuran'",
      "total_case": 9,
      "passed": 0,
      "failed": 0,
      "not_tested": 9,
      "completeness": 0.0
    }
  ],
  "notes": [
    {
      "kind": "source",
      "label": "DEMO-5385",
      "detail": "https://example.atlassian.net/browse/DEMO-5385"
    },
    {
      "kind": "correction",
      "label": "Label tombol",
      "detail": "AC menulis 'Cek Limit dan akad'. Test case menggunakan 'Cek Limit dan Akad SIKP' sesuai label yang dideskripsikan pada requirement."
    },
    {
      "kind": "assumption",
      "label": "Asumsi 1",
      "detail": "Modal sukses dan modal error diasumsikan dua fungsi terpisah karena judul modalnya berbeda ('get_limit_sikp' vs 'get_limit_dan_akad_sikp'). Perlu dikonfirmasi ke BA."
    },
    {
      "kind": "assumption",
      "label": "Asumsi 2",
      "detail": "Tombol diasumsikan tidak tampil sama sekali pada pengajuan KUK, bukan tampil namun disabled. AC tidak menyebut perilaku spesifiknya."
    }
  ],
  "stats": {
    "total_cases": 9,
    "by_class": { "positive": 6, "negative": 2, "boundary": 1 },
    "by_priority": { "High": 8, "Medium": 1, "Low": 0 },
    "ac_total": 6,
    "ac_covered": 6,
    "ac_uncovered": []
  },
  "warnings": []
}
```

### 8.4 Error response

```json
{
  "error": {
    "code": "schema_validation_failed",
    "message": "Model output failed validation after 1 retry",
    "details": [
      "TC-01-03: expected_result rejected, matched denylist term 'berhasil' with no verifiable condition"
    ]
  }
}
```

Codes: `requirement_too_short`, `schema_validation_failed`, `llm_timeout`, `llm_rate_limited`, `export_failed`.

### 8.5 Export endpoint

```http
POST /api/v1/export
Content-Type: application/json
```

```json
{
  "format": "xlsx",
  "project_name": "Pega Micro - Mapping Bunga Graduasi",
  "project_no": "2757/NHC/CBS/IT/6.02/X/25",
  "created_by": "Darrent Matthew Chandra",
  "result": { "...": "the reviewed GenerationResult, edits included" }
}
```

Returns `200` with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment`. `format: "csv"` returns the Test Script sheet only, as `text/csv`.

## 9. Tech Stack Recommendation

Chosen for build speed over architectural purity, which is the correct trade for a weekend project.

| Layer | Choice | Why |
|---|---|---|
| Backend | Python + FastAPI | Three endpoints. Pydantic models are simultaneously the API contract, the LLM tool schema, and the export validator. One definition, three jobs. |
| LLM | Claude API with tool-use structured output | Schema-constrained generation means no parsing of model prose. One versioned prompt file in the repo. |
| Frontend | React + Vite + Tailwind | One page, one editable table, one assumptions panel. TanStack Table if editing gets fiddly, plain state if not. |
| Export | openpyxl | Four sheets, bold header row only, no fills. The template is plain by design and that keeps export code short. |
| State | Browser session only | No database in MVP. Removes setup, migration, and hosting complexity entirely. |
| Deploy | Existing Hetzner VPS, Docker Compose, Caddy for TLS | Already running. A live shareable link matters more than the hosting story. |

**Build order:** schema first, then prompt (iterate in a notebook until output quality holds), then the FastAPI endpoint, then export, then UI. The prompt and the schema are the product. The UI is packaging.

## 10. Success Metrics (Portfolio Demo)

Demo and evaluation metrics, not product KPIs. Stated honestly as such.

1. **Live demo works cold.** A reviewer opens the URL and produces a full workbook in under 2 minutes with no explanation from me.
2. **Paste-in test passes.** Generated output pasted into the real project script needs no structural fixes, only content review.
3. **Style fidelity is measurable.** Run the tool against an AC whose hand-written script already exists, then diff: column match, title convention match, step convention match, expected result specificity. Publish the score including the misses.
4. **Coverage is provably systematic.** Every generation produces positive, negative, and boundary cases per group, and reports uncovered AC rather than silently dropping them.
5. **Manual baseline comparison.** README documents a timed comparison on one real story: hand-written vs. generated, case count and minutes. Honest numbers, including where the model was wrong.
6. **Failure modes are documented.** README has a "where this breaks" section: vague AC, domain rules not present in the text, hallucinated UI labels, table and column names it cannot know. Naming the limits is what separates a portfolio project from a demo toy.
7. **Code is readable.** Typed end to end, one prompt file, a README a reviewer can follow in 5 minutes.

## 11. Explicitly Out of Scope

- Authentication, user accounts, roles, permissions.
- Database persistence, saved projects, version history.
- Test execution, run results, pass/fail tracking, defect workflow. The Defect List sheet exports empty by design.
- Jira write-back (creating Xray or Zephyr test issues).
- Generated automation scripts.
- Multi-user collaboration, comments, review workflow.
- Fine-tuning or self-hosting a model.
- Mobile-responsive polish beyond "does not break on a laptop".
- Analytics, dashboards, usage charts.
- Any compliance, audit trail, or data residency handling. The demo warns explicitly against pasting real client requirements into it, and the sample data shipped with it is sanitised.
