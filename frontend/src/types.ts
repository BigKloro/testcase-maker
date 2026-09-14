// Mirror of backend/app/schemas.py (PRD section 7.3 / 8.1).

export type Language = "id" | "en";
export type PosNeg = "Positive" | "Negative";
export type CaseClass = "positive" | "negative" | "boundary";
export type Priority = "High" | "Medium" | "Low";
export type TestType = "Functional" | "Non-Functional" | "Regression" | "Integration";
export type NoteKind = "source" | "correction" | "assumption" | "dedup";

export const CASE_CLASSES: CaseClass[] = ["positive", "negative", "boundary"];
export const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
export const TEST_TYPES: TestType[] = ["Functional", "Non-Functional", "Regression", "Integration"];

export interface TestCase {
  tc_id: string;
  title: string;
  pos_neg: PosNeg;
  case_class: CaseClass;
  priority: Priority;
  type: TestType;
  precondition: string;
  test_steps: string[];
  expected_result: string;
  requirement_ref: string;
  status: string;
  tested_by: string;
  execution_date: string | null;
  notes: string;
}

export interface Group {
  group_no: number;
  group_label: string;
  req_no: string;
  test_cases: TestCase[];
}

export interface Story {
  story_key: string | null;
  story_title: string | null;
  story_url: string | null;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
}

export interface RtmRow {
  req_no: string;
  requirement: string;
  total_case: number;
  passed: number;
  failed: number;
  not_tested: number;
  completeness: number;
}

export interface Note {
  kind: NoteKind;
  label: string;
  detail: string;
}

export interface Stats {
  total_cases: number;
  by_class: Record<CaseClass, number>;
  by_priority: Record<Priority, number>;
  ac_total: number;
  ac_covered: number;
  ac_uncovered: string[];
}

export interface GenerationResult {
  generation_id: string;
  created_at: string;
  model: string;
  language: Language;
  system_under_test: string;
  story: Story;
  acceptance_criteria: AcceptanceCriterion[];
  groups: Group[];
  rtm: RtmRow[];
  notes: Note[];
  stats: Stats;
  warnings: string[];
}

export interface GenerateRequest {
  requirement_text: string;
  system_under_test: string;
  story_key: string | null;
  story_title: string | null;
  story_url: string | null;
  language: Language;
  req_prefix: string;
  target_case_count: number | null;
  default_priority: Priority;
  default_type: TestType;
  include_rtm: boolean;
}

export interface JiraTicket {
  story_key: string;
  story_title: string;
  story_url: string;
  requirement_text: string;
  warnings: string[];
}

export interface Health {
  ok: boolean;
  model: string;
  effort: string;
  mock: boolean;
  jira: boolean;
}

export interface ExportMeta {
  project_name: string;
  project_no: string;
  created_by: string;
}
