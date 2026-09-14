import type { CaseClass, ExportMeta, GenerateRequest, GenerationResult, Health, JiraTicket, TestCase } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

export const generate = (req: GenerateRequest) => post<GenerationResult>("/api/v1/generate", req);

export const regenerateCase = (tc_id: string, requirement_text: string, instruction: string | null, result: GenerationResult) =>
  post<TestCase>("/api/v1/regenerate-case", { tc_id, requirement_text, instruction, result });

export async function exportFile(format: "xlsx" | "csv", meta: ExportMeta, result: GenerationResult): Promise<void> {
  const r = await fetch("/api/v1/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, ...meta, result }),
  });
  if (!r.ok) throw new Error(await errorText(r));
  const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `test-script.${format}`;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
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
