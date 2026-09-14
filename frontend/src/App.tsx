import { useEffect, useState } from "react";
import { exportFile, fetchJira, generate, getHealth, recompute, regenerateCase } from "./api";
import { EMPTY, SAMPLES } from "./samples";
import { ScriptTable } from "./ScriptTable";
import { PRIORITIES, TEST_TYPES, type ExportMeta, type GenerateRequest, type GenerationResult, type NoteKind } from "./types";

const SUT_OPTIONS = ["PEGA", "T24", "CardPerfect", "Web App", "REST API"];
const NOTE_TITLES: Record<NoteKind, string> = {
  correction: "Corrections against the AC text",
  assumption: "Assumptions to confirm with the BA",
  dedup: "Deduplication",
  source: "Source",
};
const STORAGE = "testcase-maker:v1";

function load(): { form: GenerateRequest; result: GenerationResult | null; meta: ExportMeta } {
  try {
    const s = sessionStorage.getItem(STORAGE);
    if (s) return JSON.parse(s);
  } catch {
    /* ignore */
  }
  return { form: EMPTY, result: null, meta: { project_name: "", project_no: "", created_by: "" } };
}

const field = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-sky-500 focus:outline-none";
const label = "block text-xs font-medium text-slate-600";

export default function App() {
  const initial = load();
  const [form, setForm] = useState<GenerateRequest>(initial.form);
  const [result, setResult] = useState<GenerationResult | null>(initial.result);
  const [meta, setMeta] = useState<ExportMeta>(initial.meta);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState<string | null>(null);
  const [showAc, setShowAc] = useState(false);
  const [jiraOn, setJiraOn] = useState(false);
  const [jiraKey, setJiraKey] = useState("");
  const [jiraBusy, setJiraBusy] = useState(false);
  const [notice, setNotice] = useState<string[]>([]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE, JSON.stringify({ form, result, meta }));
  }, [form, result, meta]);

  // Jira control only appears when the server has credentials. The public demo has none.
  useEffect(() => {
    getHealth()
      .then((h) => setJiraOn(h.jira))
      .catch(() => setJiraOn(false));
  }, []);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const set = <K extends keyof GenerateRequest>(k: K, v: GenerateRequest[K]) => setForm((f) => ({ ...f, [k]: v }));
  const nullable = (v: string) => (v.trim() === "" ? null : v);

  async function onFetchJira() {
    if (!jiraKey.trim()) return;
    setJiraBusy(true);
    setError(null);
    setNotice([]);
    try {
      const t = await fetchJira(jiraKey);
      setForm((f) => ({ ...f, story_key: t.story_key, story_title: t.story_title, story_url: t.story_url, requirement_text: t.requirement_text }));
      setNotice(t.warnings);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setJiraBusy(false);
    }
  }

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const req = { ...form, story_key: nullable(form.story_key ?? ""), story_title: nullable(form.story_title ?? ""), story_url: nullable(form.story_url ?? "") };
      setResult(await generate(req));
      setMeta((m) => ({ ...m, project_name: m.project_name || form.story_title || "" }));
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate(tc_id: string) {
    if (!result) return;
    const instruction = prompt(`Regenerate ${tc_id}. Optional instruction for the model (e.g. "make it a boundary case on the max amount"):`, "");
    if (instruction === null) return;
    setRegenBusy(tc_id);
    setError(null);
    try {
      const fresh = await regenerateCase(tc_id, form.requirement_text, instruction || null, result);
      setResult(
        recompute({
          ...result,
          groups: result.groups.map((g) => ({ ...g, test_cases: g.test_cases.map((c) => (c.tc_id === tc_id ? fresh : c)) })),
        }),
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setRegenBusy(null);
    }
  }

  async function onExport(format: "xlsx" | "csv") {
    if (!result) return;
    setError(null);
    try {
      await exportFile(format, meta, result);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  const s = result?.stats;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TestCase Maker</h1>
          <p className="text-sm text-slate-600">SIT/UAT test script from a requirement. First draft in a minute, you review. Exports the real 4-sheet workbook.</p>
        </div>
        <p className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Public demo. Do not paste real client requirements.</p>
      </header>

      {/* ---------------- input ---------------- */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Load a sample:</span>
          {SAMPLES.map((smp) => (
            <button key={smp.label} type="button" onClick={() => setForm(smp.req)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100">
              {smp.label}
            </button>
          ))}
          {jiraOn && (
            <div className="ml-auto flex items-center gap-1">
              <input
                className="w-56 rounded border border-slate-300 px-2 py-0.5 text-xs focus:border-sky-500 focus:outline-none"
                value={jiraKey}
                onChange={(e) => setJiraKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onFetchJira()}
                placeholder="DEMO-5385 or a browse URL"
              />
              <button
                type="button"
                onClick={onFetchJira}
                disabled={jiraBusy || !jiraKey.trim()}
                className="rounded bg-slate-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                {jiraBusy ? "Fetching…" : "Fetch from Jira"}
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div>
            <label className={label}>Requirement / user story / acceptance criteria</label>
            <textarea
              className={`${field} min-h-[220px] font-mono text-xs leading-relaxed`}
              value={form.requirement_text}
              onChange={(e) => set("requirement_text", e.target.value)}
              placeholder="Paste the Jira description or AC list here (40 to 20,000 characters)."
              maxLength={20000}
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">{form.requirement_text.length} / 20000</div>
          </div>
          <div className="grid grid-cols-2 gap-2 content-start">
            <div className="col-span-2">
              <label className={label}>System under test</label>
              <input className={field} list="sut" value={form.system_under_test} onChange={(e) => set("system_under_test", e.target.value)} />
              <datalist id="sut">
                {SUT_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={label}>Story key</label>
              <input className={field} value={form.story_key ?? ""} onChange={(e) => set("story_key", e.target.value)} placeholder="DEMO-5385" />
            </div>
            <div>
              <label className={label}>TC ID prefix (first group)</label>
              <input className={field} value={form.req_prefix} onChange={(e) => set("req_prefix", e.target.value.toUpperCase())} pattern="TC-\d{2}" placeholder="TC-01" />
            </div>
            <div className="col-span-2">
              <label className={label}>Story title</label>
              <input className={field} value={form.story_title ?? ""} onChange={(e) => set("story_title", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={label}>Story URL (goes to the Note sheet)</label>
              <input className={field} value={form.story_url ?? ""} onChange={(e) => set("story_url", e.target.value)} placeholder="https://…/browse/KEY-123" />
            </div>
            <div>
              <label className={label}>Language</label>
              <select className={field} value={form.language} onChange={(e) => set("language", e.target.value as GenerateRequest["language"])}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className={label}>Target case count (soft)</label>
              <input
                className={field}
                type="number"
                min={1}
                max={120}
                value={form.target_case_count ?? ""}
                onChange={(e) => set("target_case_count", e.target.value ? Number(e.target.value) : null)}
                placeholder="model decides"
              />
            </div>
            <div>
              <label className={label}>Default priority</label>
              <select className={field} value={form.default_priority} onChange={(e) => set("default_priority", e.target.value as GenerateRequest["default_priority"])}>
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Default type</label>
              <select className={field} value={form.default_type} onChange={(e) => set("default_type", e.target.value as GenerateRequest["default_type"])}>
                {TEST_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.include_rtm} onChange={(e) => set("include_rtm", e.target.checked)} /> Include RTM sheet
            </label>
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy || form.requirement_text.trim().length < 40 || !form.system_under_test.trim()}
              className="col-span-2 rounded bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? `Generating… ${elapsed}s` : "Generate test script"}
            </button>
            {busy && <p className="col-span-2 text-xs text-slate-500">One Claude call with a schema-constrained output. 20 to 90 seconds depending on the story size.</p>}
          </div>
        </div>
      </section>

      {notice.length > 0 && (
        <ul className="mb-4 list-disc rounded border border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          {notice.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {error && (
        <pre className="mb-4 whitespace-pre-wrap rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</pre>
      )}

      {/* ---------------- result ---------------- */}
      {result && s && (
        <>
          <section className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Stat label="Cases" value={s.total_cases} />
            <Stat label="Positive" value={s.by_class.positive} tone="emerald" />
            <Stat label="Negative" value={s.by_class.negative} tone="rose" />
            <Stat label="Boundary" value={s.by_class.boundary} tone="amber" />
            <Stat label="High / Med / Low" value={`${s.by_priority.High} / ${s.by_priority.Medium} / ${s.by_priority.Low}`} />
            <button type="button" onClick={() => setShowAc((v) => !v)} className={`rounded px-2 py-0.5 ${s.ac_uncovered.length ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
              AC covered {s.ac_covered} / {s.ac_total}
              {s.ac_uncovered.length > 0 && ` · uncovered: ${s.ac_uncovered.join(", ")}`} {showAc ? "▴" : "▾"}
            </button>
            <span className="ml-auto text-xs text-slate-400">
              {result.generation_id} · {result.model} · {result.created_at}
            </span>
          </section>

          {showAc && (
            <ol className="mb-3 grid gap-1 rounded border border-slate-200 bg-white p-3 text-sm md:grid-cols-2">
              {result.acceptance_criteria.map((a) => (
                <li key={a.id} className={`flex gap-2 rounded px-1 ${s.ac_uncovered.includes(a.id) ? "bg-rose-50" : ""}`}>
                  <span className="shrink-0 font-mono text-xs font-semibold text-slate-500">{a.id}</span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ol>
          )}

          {result.warnings.length > 0 && (
            <ul className="mb-3 list-disc rounded border border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <ScriptTable result={result} onChange={setResult} onRegenerate={onRegenerate} regenBusy={regenBusy} />

          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Assumptions and corrections</h2>
              <p className="mb-3 text-xs text-slate-500">These are the questions to take back to the BA. They export to the Note sheet. Edit before exporting.</p>
              {(["correction", "assumption", "dedup", "source"] as NoteKind[]).map((kind) => {
                const items = result.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.kind === kind);
                if (!items.length) return null;
                return (
                  <div key={kind} className="mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{NOTE_TITLES[kind]}</h3>
                    <ul className="mt-1 divide-y divide-slate-100">
                      {items.map(({ n, i }) => (
                        <li key={i} className="flex gap-3 py-1 text-sm">
                          <span className="w-28 shrink-0 font-medium text-slate-700">{n.label}</span>
                          <textarea
                            className="w-full resize-none rounded bg-transparent p-0.5 leading-snug outline-none hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-400"
                            rows={Math.max(1, Math.ceil(n.detail.length / 90))}
                            value={n.detail}
                            onChange={(e) => setResult({ ...result, notes: result.notes.map((m, j) => (j === i ? { ...m, detail: e.target.value } : m)) })}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Export</h2>
              <div className="grid gap-2">
                {(["project_name", "project_no", "created_by"] as (keyof ExportMeta)[]).map((k) => (
                  <div key={k}>
                    <label className={label}>{k.replace("_", " ")}</label>
                    <input className={field} value={meta[k]} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} />
                  </div>
                ))}
                <button type="button" onClick={() => onExport("xlsx")} className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Download XLSX (RTM · Test Script · Defect List · Note)
                </button>
                <button type="button" onClick={() => onExport("csv")} className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
                  Download CSV (Test Script only)
                </button>
                {result.rtm.length > 0 && (
                  <table className="mt-2 text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pr-2">Req</th>
                        <th className="pr-2">Requirement</th>
                        <th>Cases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rtm.map((r) => (
                        <tr key={r.req_no} className="align-top">
                          <td className="pr-2 font-mono">{r.req_no}</td>
                          <td className="pr-2">{r.requirement}</td>
                          <td className="text-right">{r.total_case}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number | string; tone?: "slate" | "emerald" | "rose" | "amber" }) {
  const tones = { slate: "text-slate-800", emerald: "text-emerald-700", rose: "text-rose-700", amber: "text-amber-700" };
  return (
    <span>
      <span className="text-xs text-slate-500">{label} </span>
      <span className={`font-semibold ${tones[tone]}`}>{value}</span>
    </span>
  );
}
