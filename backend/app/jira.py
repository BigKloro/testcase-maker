"""Pull a requirement straight from a Jira ticket.

Off unless JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN are all set, so the
public demo never carries real ticket text. Personal API token, Basic auth,
read-only. stdlib urllib: one authenticated GET does not earn a dependency.
"""

from __future__ import annotations

import base64
import json
import os
import re
import urllib.error
import urllib.request

from .generate import ApiError

TIMEOUT = 20
KEY = re.compile(r"([A-Z][A-Z0-9]+-\d+)")
# Leaf image nodes. Their containers (mediaSingle, mediaGroup) just recurse, so a
# group of three images counts as three rather than one.
MEDIA = {"media", "mediaInline"}


def base_url() -> str:
    return os.environ.get("JIRA_BASE_URL", "").strip().rstrip("/")


def enabled() -> bool:
    return bool(base_url() and os.environ.get("JIRA_EMAIL") and os.environ.get("JIRA_API_TOKEN"))


def parse_key(text: str) -> str:
    """Accept a bare key or a browse URL. Reject anything else rather than guess."""
    m = KEY.search((text or "").strip().upper())
    if not m:
        raise ApiError(400, "jira_bad_key", f"'{text}' is not a Jira issue key or browse URL")
    return m.group(1)


# ---------------------------------------------------------------------------
# Atlassian Document Format -> text
# ---------------------------------------------------------------------------
def adf_to_text(node: dict | list | None) -> tuple[str, int]:
    """Flatten an ADF document. Returns (text, media_count).

    Unknown node types recurse into their content instead of being skipped, so an
    unfamiliar macro degrades to its text rather than vanishing.
    """
    media = 0

    def inline(n: dict) -> str:
        nonlocal media
        t = n.get("type")
        if t == "text":
            return n.get("text", "")
        if t == "hardBreak":
            return "\n"
        if t in ("inlineCard", "blockCard"):
            return (n.get("attrs") or {}).get("url", "")
        if t == "mention":
            return (n.get("attrs") or {}).get("text", "")
        if t == "emoji":
            return (n.get("attrs") or {}).get("shortName", "")
        if t in MEDIA:
            media += 1
            return ""
        return "".join(inline(c) for c in n.get("content") or [])

    def block(n: dict, depth: int = 0) -> list[str]:
        nonlocal media
        t = n.get("type")
        kids = n.get("content") or []
        if t in MEDIA:
            media += 1
            return []
        if t == "rule":
            return ["---"]
        if t in ("paragraph", "heading"):
            text = "".join(inline(c) for c in kids).strip()
            if not text:
                return []
            return [("#" * (n.get("attrs") or {}).get("level", 1) + " " + text) if t == "heading" else text]
        if t in ("bulletList", "orderedList"):
            out: list[str] = []
            for i, item in enumerate(kids, 1):
                marker = f"{i}." if t == "orderedList" else "-"
                lines = [l for c in item.get("content") or [] for l in block(c, depth + 1)]
                for j, line in enumerate(lines):
                    out.append(("  " * depth) + (f"{marker} {line}" if j == 0 else f"  {line}"))
            return ["\n".join(out)]  # one block, so the list reads as a list rather than scattered lines
        if t == "table":
            rows = []
            for row in kids:
                cells = ["".join(inline(c) for c in cell.get("content") or []).strip() for cell in row.get("content") or []]
                rows.append(" | ".join(cells))
            return ["\n".join(rows)]  # keep the table together
        if t == "codeBlock":
            return ["".join(inline(c) for c in kids)]
        # blockquote, panel, listItem, doc, and anything unrecognised
        return [l for c in kids for l in block(c, depth)]

    if not isinstance(node, dict):
        return "", 0
    lines = [l for c in node.get("content") or [] for l in block(c)]
    return "\n\n".join(l for l in lines if l.strip()), media


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------
def fetch_issue(raw_key: str) -> dict:
    if not enabled():
        raise ApiError(501, "jira_not_configured", "Jira is not configured on this server. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.")
    key = parse_key(raw_key)
    auth = base64.b64encode(f"{os.environ['JIRA_EMAIL']}:{os.environ['JIRA_API_TOKEN']}".encode()).decode()
    url = f"{base_url()}/rest/api/3/issue/{key}?fields=summary,description"
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise ApiError(404, "jira_issue_not_found", f"{key} does not exist or the token cannot see it") from None
        if e.code in (401, 403):
            raise ApiError(502, "jira_error", "Jira rejected the credentials") from None
        raise ApiError(502, "jira_error", f"Jira returned HTTP {e.code}") from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        raise ApiError(502, "jira_error", f"Could not reach Jira: {e.__class__.__name__}") from None

    fields = data.get("fields") or {}
    text, media = adf_to_text(fields.get("description"))
    warnings = []
    if media:
        warnings.append(
            f"This ticket embeds {media} image{'s' if media != 1 else ''}. Their content is NOT included above. "
            "Open the ticket and read the screenshots; exact labels and error text often live only there."
        )
    if not text.strip():
        warnings.append("The description is empty. Paste the requirement manually.")
    return {
        "story_key": key,
        "story_title": fields.get("summary") or "",
        "story_url": f"{base_url()}/browse/{key}",
        "requirement_text": text,
        "warnings": warnings,
    }
