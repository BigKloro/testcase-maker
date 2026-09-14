"""Single source of truth: API contract, LLM output schema, and export input.

The model writes *Draft models (content only). The server adds ids, ordering,
Pos/Neg mapping and the always-empty execution columns.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["id", "en"]
PosNeg = Literal["Positive", "Negative"]
CaseClass = Literal["positive", "negative", "boundary"]
Priority = Literal["High", "Medium", "Low"]
TestType = Literal["Functional", "Non-Functional", "Regression", "Integration"]
ExecStatus = Literal["", "Passed", "Failed", "Not Tested", "On Hold", "Defect"]
NoteKind = Literal["source", "correction", "assumption", "dedup"]


# ---------------------------------------------------------------------------
# What the model writes (this is the structured-output schema handed to Claude)
# ---------------------------------------------------------------------------
class CaseDraft(BaseModel):
    title: str = Field(description="Title / Description. Positive: starts with the language's positive prefix. No trailing period.")
    case_class: CaseClass
    priority: Priority
    type: TestType
    precondition: str = Field(description="System state, data state, role. '' only when none.")
    test_steps: list[str] = Field(description="One imperative action per element. Element 0 is the login/entry point.")
    expected_result: str = Field(description="Specific, verifiable, quotes exact labels/values in single quotes.")
    requirement_ref: str = Field(description="Single AC id this case verifies, e.g. 'AC-3'.")


class GroupDraft(BaseModel):
    group_label: str = Field(description="Functional flow under test, quoting exact UI labels.")
    test_cases: list[CaseDraft]


class AcceptanceCriterion(BaseModel):
    id: str = Field(description="'AC-1', 'AC-2', ... sequential.")
    text: str = Field(description="One atomic, verifiable rule extracted from the requirement.")


class Note(BaseModel):
    kind: NoteKind
    label: str
    detail: str


class LlmOutput(BaseModel):
    acceptance_criteria: list[AcceptanceCriterion]
    groups: list[GroupDraft]
    notes: list[Note]


# ---------------------------------------------------------------------------
# API contract (PRD section 7.3 / 8)
# ---------------------------------------------------------------------------
class TestCase(CaseDraft):
    tc_id: str
    pos_neg: PosNeg
    status: ExecStatus = ""
    tested_by: str = ""
    execution_date: str | None = None
    notes: str = ""


class Group(BaseModel):
    group_no: int
    group_label: str
    req_no: str
    test_cases: list[TestCase]


class Story(BaseModel):
    story_key: str | None = None
    story_title: str | None = None
    story_url: str | None = None


class RtmRow(BaseModel):
    req_no: str
    requirement: str
    total_case: int
    passed: int = 0
    failed: int = 0
    not_tested: int = 0
    completeness: float = 0.0


class ByClass(BaseModel):
    positive: int = 0
    negative: int = 0
    boundary: int = 0


class ByPriority(BaseModel):
    High: int = 0
    Medium: int = 0
    Low: int = 0


class Stats(BaseModel):
    total_cases: int
    by_class: ByClass
    by_priority: ByPriority
    ac_total: int
    ac_covered: int
    ac_uncovered: list[str]


class GenerationResult(BaseModel):
    generation_id: str
    created_at: str
    model: str
    language: Language
    system_under_test: str
    story: Story
    acceptance_criteria: list[AcceptanceCriterion]
    groups: list[Group]
    rtm: list[RtmRow]
    notes: list[Note]
    stats: Stats
    warnings: list[str]


class GenerateRequest(BaseModel):
    requirement_text: str = Field(min_length=1, max_length=20000)
    system_under_test: str = Field(min_length=1, max_length=80)
    story_key: str | None = Field(default=None, max_length=40)
    story_title: str | None = Field(default=None, max_length=200)
    story_url: str | None = Field(default=None, max_length=500)
    language: Language = "id"
    req_prefix: str = Field(default="TC-01", pattern=r"^TC-\d{2}$")
    target_case_count: int | None = Field(default=None, ge=1, le=120)
    default_priority: Priority = "High"
    default_type: TestType = "Functional"
    include_rtm: bool = True


class RegenerateRequest(BaseModel):
    tc_id: str
    requirement_text: str = Field(min_length=1, max_length=20000)
    instruction: str | None = Field(default=None, max_length=500)
    result: GenerationResult


class JiraTicket(BaseModel):
    story_key: str
    story_title: str
    story_url: str
    requirement_text: str
    warnings: list[str] = []


class ExportRequest(BaseModel):
    format: Literal["xlsx", "csv"] = "xlsx"
    project_name: str = ""
    project_no: str = ""
    created_by: str = ""
    result: GenerationResult
