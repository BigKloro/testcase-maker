import type { CaseClass, ExportMeta, GenerateRequest, GenerationResult, Health, JiraTicket, TestCase } from "./types";

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error(await errorText(r));
  return r.json();
}

async function errorText(r: Response): Promise<string> {
  try {
    const e = await r.json();
    const d: string[] = e.error?.details ?? [];
    return `${e.error?.code ?? r.status}: ${e.error?.message ?? r.statusText}` + (d.length ? "\n" + d.join("\n") : "");
  } catch {
    return `HTTP ${r.status} ${r.statusText}`;
  }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(await errorText(r));
  return r.json();
}

export const getHealth = () => get<Health>("/api/v1/health");

export const fetchJira = (key: string) => get<JiraTicket>(`/api/v1/jira?key=${encodeURIComponent(key.trim())}`);

export const generate = async (req: GenerateRequest, signal?: AbortSignal) => withUids(await post<GenerationResult>("/api/v1/generate", req, signal));

export const regenerateCase = (tc_id: string, requirement_text: string, instruction: string | null, result: GenerationResult) =>
  post<TestCase>("/api/v1/regenerate-case", { tc_id, requirement_text, instruction, result: stripUids(result) });

// ---------------------------------------------------------------------------
// Client-only row keys. tc_id changes on every move/delete, so React needs its own stable key.
// ---------------------------------------------------------------------------
export const newUid = () => Math.random().toString(36).slice(2, 10);

export const withUids = (r: GenerationResult): GenerationResult => ({
  ...r,
  groups: r.groups.map((g) => ({ ...g, uid: g.uid ?? newUid(), test_cases: g.test_cases.map((c) => ({ ...c, uid: c.uid ?? newUid() })) })),
});

export const stripUids = (r: GenerationResult): GenerationResult => ({
  ...r,
  groups: r.groups.map(({ uid: _g, ...g }) => ({ ...g, test_cases: g.test_cases.map(({ uid: _c, ...c }) => c) })),
});

export async function exportFile(format: "xlsx" | "csv", meta: ExportMeta, result: GenerationResult): Promise<void> {
  const r = await fetch("/api/v1/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, ...meta, result: stripUids(result) }),
  });
  if (!r.ok) throw new Error(await errorText(r));
  const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `test-script.${format}`;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking in the same tick can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Re-derive ids, Pos/Neg, RTM totals and stats after an edit (mirrors backend finalize()). */
export function recompute(r: GenerationResult): GenerationResult {
  const start = r.groups[0] ? parseInt(r.groups[0].req_no.split("-")[1], 10) : 1;
  const groups = r.groups.map((g, gi) => {
    const req_no = `TC-${String(start + gi).padStart(2, "0")}`;
    return {
      ...g,
      group_no: gi + 1,
      req_no,
      test_cases: g.test_cases.map((c, ci) => ({
        ...c,
        tc_id: `${req_no}-${String(ci + 1).padStart(2, "0")}`,
        pos_neg: c.case_class === "positive" ? ("Positive" as const) : ("Negative" as const),
      })),
    };
  });
  const prefix = r.story.story_key ? `${r.story.story_key} | ` : "";
  const rtm = r.rtm.length
    ? groups.map((g) => ({
        req_no: g.req_no,
        requirement: `${prefix}Group ${g.group_no}: ${g.group_label}`,
        total_case: g.test_cases.length,
        passed: 0,
        failed: 0,
        not_tested: g.test_cases.length,
        completeness: 0,
      }))
    : [];
  const all = groups.flatMap((g) => g.test_cases);
  const count = <K extends string>(keys: readonly K[], pick: (c: TestCase) => string) =>
    Object.fromEntries(keys.map((k) => [k, all.filter((c) => pick(c) === k).length])) as Record<K, number>;
  const refs = new Set(all.map((c) => c.requirement_ref));
  const ac_uncovered = r.acceptance_criteria.map((a) => a.id).filter((id) => !refs.has(id));
  return {
    ...r,
    groups,
    rtm,
    stats: {
      total_cases: all.length,
      by_class: count(["positive", "negative", "boundary"] as CaseClass[], (c) => c.case_class),
      by_priority: count(["High", "Medium", "Low"] as const, (c) => c.priority),
      ac_total: r.acceptance_criteria.length,
      ac_covered: r.acceptance_criteria.length - ac_uncovered.length,
      ac_uncovered,
    },
  };
}
