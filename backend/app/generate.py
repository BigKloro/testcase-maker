"""Prompt assembly, Claude call, server-side validation, one retry, and derivation
of ids / RTM / stats. This file plus prompts/sit_style_v1.md is the product."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import TYPE_CHECKING

from .schemas import (
    CaseDraft,
    GenerateRequest,
    GenerationResult,
    Group,
    GroupDraft,
    LlmOutput,
    Note,
    RegenerateRequest,
    RtmRow,
    Stats,
    Story,
    TestCase,
)

if TYPE_CHECKING:
    import anthropic

MODEL = os.environ.get("TESTCASE_MAKER_MODEL", "claude-opus-5")
EFFORT = os.environ.get("TESTCASE_MAKER_EFFORT", "high")  # low | medium | high | xhigh | max
MOCK = bool(os.environ.get("TESTCASE_MAKER_MOCK"))  # ponytail: fixture instead of Claude, for UI dev without a key
PROMPT = Template((Path(__file__).parent / "prompts" / "sit_style_v1.md").read_text(encoding="utf-8"))
FIXTURE = Path(__file__).parents[1] / "tests" / "fixture_llm_output.json"

LANG = {
    "id": dict(
        language_name="Bahasa Indonesia",
        positive_prefix="Memastikan ",
        verbs="Login, Buka, Klik, Pilih, Isi, Cek, Query, Submit, Kirim",
        chain_word="dan kemudian",
        bare_words="berhasil / sukses / berjalan dengan baik",
        assumption_label="Asumsi",
    ),
    "en": dict(
        language_name="English",
        positive_prefix="Verify ",
        verbs="Log in, Open, Click, Select, Fill, Check, Query, Submit, Send",
        chain_word="and then",
        bare_words="success / works / passes",
        assumption_label="Assumption",
    ),
}

ENTRY_KEYWORDS = re.compile(
    r"\b(login|log in|masuk|buka|open|kirim|send|hit|call|panggil|akses|access|jalankan|run|"
    r"navigasi|navigate|query|get|post|put|patch|delete|connect|launch)\b",
    re.I,
)
BARE_RESULT = re.compile(r"^\W*(berhasil|sukses|success(ful)?|ok|passed?|works?|gagal|error)\W*$", re.I)
DENY_WORDS = re.compile(r"\b(berhasil|sukses|success(fully)?)\b", re.I)
CHAIN = re.compile(r"\b(dan kemudian|and then)\b", re.I)
AC_ID = re.compile(r"AC-\d+")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: list[str] | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details or []


_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        import anthropic  # deferred: the SDK takes ~0.7s to import and mock mode / tests never call it

        _client = anthropic.Anthropic()  # ANTHROPIC_API_KEY from env / .env
    return _client


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
def build_system(language: str, sut: str, default_priority: str, default_type: str, target: int | None) -> str:
    return PROMPT.safe_substitute(
        system_under_test=sut,
        default_priority=default_priority,
        default_type=default_type,
        target_case_count=f"about {target} cases" if target else "not set, you decide (typically 8 to 25 for one story)",
        **LANG[language],
    )


def build_user(req: GenerateRequest) -> str:
    ctx = [f"System under test: {req.system_under_test}"]
    if req.story_key:
        ctx.append(f"Story key: {req.story_key}")
    if req.story_title:
        ctx.append(f"Story title: {req.story_title}")
    if req.story_url:
        ctx.append(f"Story URL: {req.story_url}")
    return "\n".join(ctx) + f"\n\nRequirement text:\n<<<\n{req.requirement_text.strip()}\n>>>\n\nGenerate the test script now."


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------
def _call(system: str, messages: list[dict], schema_model: type, max_tokens: int = 32000) -> tuple[dict, str]:
    """Returns (parsed JSON, model id). Structured output guarantees the text block is schema-valid JSON."""
    if MOCK:
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        if schema_model is CaseDraft:
            data = data["groups"][0]["test_cases"][0]
        return data, "mock"
    import anthropic
    from anthropic.lib._parse._transform import transform_schema

    try:
        with _get_client().messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=messages,
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": transform_schema(schema_model)}},
        ) as stream:
            msg = stream.get_final_message()
    except anthropic.RateLimitError as e:
        raise ApiError(429, "llm_rate_limited", "Claude API rate limit hit, retry in a minute", [str(e)]) from e
    except anthropic.APITimeoutError as e:
        raise ApiError(504, "llm_timeout", "Claude API timed out", [str(e)]) from e
    except anthropic.AuthenticationError as e:
        raise ApiError(502, "llm_error", "Claude API rejected the key (ANTHROPIC_API_KEY)", [str(e)]) from e
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        raise ApiError(502, "llm_error", "Claude API call failed", [str(e)]) from e

    if msg.stop_reason == "refusal":
        raise ApiError(502, "llm_error", "Claude declined this request", [getattr(msg.stop_details, "explanation", "") or ""])
    if msg.stop_reason == "max_tokens":
        raise ApiError(502, "llm_error", "Output truncated at max_tokens; lower target_case_count or split the story")
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        return json.loads(text), msg.model
    except json.JSONDecodeError as e:
        raise ApiError(502, "llm_error", "Claude returned non-JSON output", [str(e)]) from e


# ---------------------------------------------------------------------------
# Validation (PRD 7.4). errors -> retry once; warnings -> surfaced in result
# ---------------------------------------------------------------------------
def tidy(groups: list[GroupDraft]) -> None:
    """Mechanical fixes that need no retry."""
    for g in groups:
        g.group_label = g.group_label.strip().rstrip(".")
        for c in g.test_cases:
            c.title = c.title.strip().rstrip(".")
            c.precondition = c.precondition.strip()
            c.expected_result = c.expected_result.strip()
            c.test_steps = [re.sub(r"^\s*\d+[.)]\s*", "", s).strip() for s in c.test_steps if s.strip()]
            m = AC_ID.search(c.requirement_ref or "")
            c.requirement_ref = m.group(0) if m else c.requirement_ref.strip()


def validate(groups: list[GroupDraft], language: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    prefix = LANG[language]["positive_prefix"]
    for gi, g in enumerate(groups, 1):
        if not g.test_cases:
            errors.append(f"Group {gi} ('{g.group_label}') has no test cases")
            continue
        if {c.case_class for c in g.test_cases} == {"positive"}:
            warnings.append(f"Group {gi} ('{g.group_label}') has only positive cases")
        for ci, c in enumerate(g.test_cases, 1):
            ref = f"Group {gi} case {ci} ('{c.title[:60]}')"
            if c.case_class == "positive" and not c.title.startswith(prefix):
                errors.append(f"{ref}: positive title must start with '{prefix.strip()}'")
            if c.case_class != "positive" and c.title.lower().startswith(prefix.lower()):
                errors.append(f"{ref}: negative/boundary title must not start with '{prefix.strip()}'")
            if not c.test_steps:
                errors.append(f"{ref}: test_steps is empty")
            elif not ENTRY_KEYWORDS.search(c.test_steps[0]):
                errors.append(f"{ref}: step 1 must be the login/entry point, got '{c.test_steps[0][:60]}'")
            er = c.expected_result
            if len(er) < 15 or BARE_RESULT.match(er):
                errors.append(f"{ref}: expected_result rejected, not verifiable: '{er[:60]}'")
            elif (m := DENY_WORDS.search(er)) and "'" not in er:
                warnings.append(f"{ref}: expected_result says '{m.group(0)}' without a quoted label or value")
            if not AC_ID.fullmatch(c.requirement_ref):
                errors.append(f"{ref}: requirement_ref must be one AC id like 'AC-3', got '{c.requirement_ref}'")
            for si, s in enumerate(c.test_steps, 1):
                if len(s) > 200:
                    warnings.append(f"{ref}: step {si} is longer than 200 characters")
                if CHAIN.search(s):
                    warnings.append(f"{ref}: step {si} chains two actions")
    return errors, warnings


def _fix_prompt(errors: list[str]) -> str:
    return "Your output violated these rules. Return the complete corrected JSON object (all groups, all cases), fixing only what is listed:\n- " + "\n- ".join(errors)


# ---------------------------------------------------------------------------
# Derivation: ids, ordering, Pos/Neg, RTM, stats
# ---------------------------------------------------------------------------
def finalize(out: LlmOutput, req: GenerateRequest, model: str, warnings: list[str]) -> GenerationResult:
    start = int(req.req_prefix.split("-")[1])
    groups: list[Group] = []
    for gi, g in enumerate(out.groups):
        req_no = f"TC-{start + gi:02d}"
        ordered = sorted(g.test_cases, key=lambda c: c.case_class != "positive")  # stable: positives first
        cases = [
            TestCase(
                **c.model_dump(),
                tc_id=f"{req_no}-{ci:02d}",
                pos_neg="Positive" if c.case_class == "positive" else "Negative",
            )
            for ci, c in enumerate(ordered, 1)
        ]
        groups.append(Group(group_no=gi + 1, group_label=g.group_label, req_no=req_no, test_cases=cases))

    story = Story(story_key=req.story_key, story_title=req.story_title, story_url=req.story_url)
    prefix = f"{req.story_key} | " if req.story_key else ""
    rtm = [
        RtmRow(
            req_no=g.req_no,
            requirement=f"{prefix}Group {g.group_no}: {g.group_label}",
            total_case=len(g.test_cases),
            not_tested=len(g.test_cases),
        )
        for g in groups
    ] if req.include_rtm else []

    notes = [n for n in out.notes if n.kind != "source"]
    if req.story_key and req.story_url:
        notes.insert(0, Note(kind="source", label=req.story_key, detail=req.story_url))

    all_cases = [c for g in groups for c in g.test_cases]
    ac_ids = [a.id for a in out.acceptance_criteria]
    refs = {c.requirement_ref for c in all_cases}
    uncovered = [a for a in ac_ids if a not in refs]
    warnings = warnings + [f"{a} produced no test case" for a in uncovered]
    warnings += [f"Case cites {r} which is not in the extracted AC list" for r in sorted(refs - set(ac_ids))]
    stats = Stats(
        total_cases=len(all_cases),
        by_class={k: sum(c.case_class == k for c in all_cases) for k in ("positive", "negative", "boundary")},
        by_priority={k: sum(c.priority == k for c in all_cases) for k in ("High", "Medium", "Low")},
        ac_total=len(ac_ids),
        ac_covered=len(ac_ids) - len(uncovered),
        ac_uncovered=uncovered,
    )
    return GenerationResult(
        generation_id="gen_" + uuid.uuid4().hex[:12].upper(),
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        model=model,
        language=req.language,
        system_under_test=req.system_under_test,
        story=story,
        acceptance_criteria=out.acceptance_criteria,
        groups=groups,
        rtm=rtm,
        notes=notes,
        stats=stats,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------
def generate(req: GenerateRequest) -> GenerationResult:
    system = build_system(req.language, req.system_under_test, req.default_priority, req.default_type, req.target_case_count)
    messages: list[dict] = [{"role": "user", "content": build_user(req)}]
    for attempt in (1, 2):
        data, model = _call(system, messages, LlmOutput)
        out = LlmOutput.model_validate(data)
        tidy(out.groups)
        errors, warnings = validate(out.groups, req.language)
        if not errors:
            return finalize(out, req, model, warnings)
        if attempt == 2:
            raise ApiError(422, "schema_validation_failed", "Model output failed validation after 1 retry", errors)
        messages += [{"role": "assistant", "content": json.dumps(data, ensure_ascii=False)}, {"role": "user", "content": _fix_prompt(errors)}]
    raise AssertionError("unreachable")


def regenerate_case(rr: RegenerateRequest) -> TestCase:
    res = rr.result
    target = next(((g, c) for g in res.groups for c in g.test_cases if c.tc_id == rr.tc_id), None)
    if target is None:
        raise ApiError(404, "case_not_found", f"{rr.tc_id} is not in the submitted script")
    group, case = target
    system = build_system(res.language, res.system_under_test, case.priority, case.type, None)
    siblings = "\n".join(f"- {c.tc_id} [{c.case_class}] {c.title}" for c in group.test_cases if c.tc_id != case.tc_id)
    ac_list = "\n".join(f"- {a.id}: {a.text}" for a in res.acceptance_criteria)
    user = (
        f"Requirement text:\n<<<\n{rr.requirement_text.strip()}\n>>>\n\n"
        f"Acceptance criteria already extracted:\n{ac_list}\n\n"
        f"Group under test: {group.group_label}\nOther cases already in this group (do not duplicate them):\n{siblings}\n\n"
        f"Rewrite this one case ({case.tc_id}). Keep its intent and requirement_ref unless the instruction says otherwise:\n"
        f"{json.dumps(CaseDraft(**case.model_dump(include=set(CaseDraft.model_fields))).model_dump(), ensure_ascii=False, indent=2)}\n\n"
        f"Instruction from the reviewer: {rr.instruction or 'make it sharper and more specific'}\n\n"
        "Return exactly one case object."
    )
    messages: list[dict] = [{"role": "user", "content": user}]
    for attempt in (1, 2):
        data, _ = _call(system, messages, CaseDraft, max_tokens=4000)
        draft = CaseDraft.model_validate(data)
        wrapper = GroupDraft(group_label=group.group_label, test_cases=[draft])
        tidy([wrapper])
        errors, _warnings = validate([wrapper], res.language)
        if not errors:
            return TestCase(**draft.model_dump(), tc_id=case.tc_id, pos_neg="Positive" if draft.case_class == "positive" else "Negative")
        if attempt == 2:
            raise ApiError(422, "schema_validation_failed", "Model output failed validation after 1 retry", errors)
        messages += [{"role": "assistant", "content": json.dumps(data, ensure_ascii=False)}, {"role": "user", "content": _fix_prompt(errors)}]
    raise AssertionError("unreachable")
