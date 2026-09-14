"""FastAPI app: three endpoints (PRD section 8) plus /health."""

from __future__ import annotations

import re

from dotenv import load_dotenv

load_dotenv()  # ANTHROPIC_API_KEY, CLAUDE_MODEL, ... from backend/.env  # noqa: E402

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse, Response  # noqa: E402

from . import generate as gen  # noqa: E402
from . import jira  # noqa: E402
from .export import to_csv, to_xlsx  # noqa: E402
from .schemas import ExportRequest, GenerateRequest, GenerationResult, JiraTicket, RegenerateRequest, TestCase  # noqa: E402

app = FastAPI(title="TestCase Maker API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.exception_handler(gen.ApiError)
def api_error(_: Request, e: gen.ApiError) -> JSONResponse:
    return JSONResponse(status_code=e.status, content={"error": {"code": e.code, "message": e.message, "details": e.details}})


@app.exception_handler(RequestValidationError)
def invalid_request(_: Request, e: RequestValidationError) -> JSONResponse:
    details = [f"{'.'.join(str(p) for p in err['loc'][1:])}: {err['msg']}" for err in e.errors()]
    return JSONResponse(status_code=422, content={"error": {"code": "invalid_request", "message": "Request body failed validation", "details": details}})


@app.get("/api/v1/health")
def health() -> dict:
    return {"ok": True, "model": gen.MODEL, "effort": gen.EFFORT, "mock": gen.MOCK, "jira": jira.enabled()}


@app.get("/api/v1/jira", response_model=JiraTicket)
def jira_issue(key: str) -> JiraTicket:
    """Pull summary and description from Jira. 501 unless credentials are configured.

    `key` is a query parameter, not a path segment: a pasted browse URL encodes to %2F
    and would never match a path route.
    """
    return JiraTicket(**jira.fetch_issue(key))


@app.post("/api/v1/generate", response_model=GenerationResult)
def generate(req: GenerateRequest) -> GenerationResult:
    if len(req.requirement_text.strip()) < 40:
        raise gen.ApiError(400, "requirement_too_short", "Paste at least one full acceptance criterion (40+ characters)")
    return gen.generate(req)


@app.post("/api/v1/regenerate-case", response_model=TestCase)
def regenerate_case(req: RegenerateRequest) -> TestCase:
    return gen.regenerate_case(req)


@app.post("/api/v1/export")
def export(req: ExportRequest) -> Response:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", req.result.story.story_key or "test-script").strip("_") or "test-script"
    try:
        if req.format == "csv":
            body, media = to_csv(req.result).encode("utf-8"), "text/csv; charset=utf-8"
        else:
            body, media = to_xlsx(req.result, req.project_name, req.project_no, req.created_by), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    except Exception as e:  # openpyxl / csv failure -> PRD error code
        raise gen.ApiError(500, "export_failed", "Export failed", [str(e)]) from e
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{stem}_test_script.{req.format}"'})
