import { useState } from "react";
import type { ExportMeta, GenerationResult, Note, NoteKind, TestCase } from "../types";
import { Badge, Button, Card, cx, Icon, IconButton, inputCls, labelCls } from "../ui";

// ---------------------------------------------------------------------------
// Summary cards above the script
// ---------------------------------------------------------------------------
export function SummaryCards({ result, onCoverage }: { result: GenerationResult; onCoverage: () => void }) {
  const s = result.stats;
  const pct = s.ac_total ? Math.round((100 * s.ac_covered) / s.ac_total) : 100;
  const bar = (n: number) => `${s.total_cases ? (100 * n) / s.total_cases : 0}%`;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4">
        <p className="text-xs font-medium text-muted">Test cases</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{s.total_cases}</p>
        <p className="text-xs text-muted">in {result.groups.length} groups</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium text-muted">Case mix</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-subtle">
          <div className="bg-emerald-500" style={{ width: bar(s.by_class.positive) }} />
          <div className="bg-rose-500" style={{ width: bar(s.by_class.negative) }} />
          <div className="bg-amber-500" style={{ width: bar(s.by_class.boundary) }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 text-xs">
          <span className="text-emerald-700 dark:text-emerald-400">● {s.by_class.positive} positive</span>
          <span className="text-rose-700 dark:text-rose-400">● {s.by_class.negative} negative</span>
          <span className="text-amber-700 dark:text-amber-400">● {s.by_class.boundary} boundary</span>
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium text-muted">Priority</p>
        <div className="mt-2 flex gap-4 text-sm">
          {(["High", "Medium", "Low"] as const).map((p) => (
            <div key={p}>
              <p className="text-xl font-semibold tabular-nums">{s.by_priority[p]}</p>
              <p className="text-xs text-muted">{p}</p>
            </div>
          ))}
        </div>
      </Card>
      <button type="button" onClick={onCoverage} className="text-left">
        <Card className={cx("h-full p-4 transition-colors hover:border-accent", s.ac_uncovered.length > 0 && "border-rose-300 dark:border-rose-900")}>
          <p className="flex items-center text-xs font-medium text-muted">
            AC coverage <Icon name="chevronDown" className="ml-auto size-3.5 -rotate-90" />
          </p>
          <p className={cx("mt-1 text-2xl font-semibold tabular-nums", s.ac_uncovered.length ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{pct}%</p>
          <p className="text-xs text-muted">
            {s.ac_covered} of {s.ac_total} criteria{s.ac_uncovered.length > 0 && ` · missing ${s.ac_uncovered.join(", ")}`}
          </p>
        </Card>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage: every AC with the cases that cite it
// ---------------------------------------------------------------------------
export function CoverageView({ result, onJump }: { result: GenerationResult; onJump: (c: TestCase) => void }) {
  const all = result.groups.flatMap((g) => g.test_cases);
  const byRef = new Map<string, TestCase[]>();
  for (const c of all) byRef.set(c.requirement_ref, [...(byRef.get(c.requirement_ref) ?? []), c]);
  const known = new Set(result.acceptance_criteria.map((a) => a.id));
  const orphans = all.filter((c) => !known.has(c.requirement_ref));
  const caseLink = (c: TestCase) => (
    <button
      key={c.uid ?? c.tc_id}
      type="button"
      title={c.title}
      onClick={() => onJump(c)}
      className={cx(
        "rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:border-accent hover:text-accent",
        c.case_class === "positive" ? "border-emerald-200 dark:border-emerald-900" : c.case_class === "negative" ? "border-rose-200 dark:border-rose-900" : "border-amber-200 dark:border-amber-900",
      )}
    >
      {c.tc_id}
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Acceptance criteria the model extracted from the requirement, with the cases that verify each one. Click a case to jump to it.</p>
      <Card className="divide-y divide-line">
        {result.acceptance_criteria.map((a) => {
          const cases = byRef.get(a.id) ?? [];
          return (
            <div key={a.id} className={cx("grid gap-2 px-4 py-3 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,280px)]", !cases.length && "bg-rose-50/60 dark:bg-rose-950/20")}>
              <span className="font-mono text-xs font-semibold text-muted">{a.id}</span>
              <p className="text-sm">{a.text}</p>
              <div className="flex flex-wrap items-start gap-1 sm:justify-end">
                {cases.length ? cases.map(caseLink) : <Badge tone="rose">No test case</Badge>}
              </div>
            </div>
          );
        })}
      </Card>
      {orphans.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Cases citing an AC that isn't in the list</p>
          <div className="flex flex-wrap gap-1">{orphans.map(caseLink)}</div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes: corrections / assumptions for the BA, exported to the Note sheet
// ---------------------------------------------------------------------------
const NOTE_TITLES: Record<NoteKind, string> = {
  correction: "Corrections against the AC text",
  assumption: "Assumptions to confirm with the BA",
  dedup: "Deduplication",
  source: "Source",
};

export function NotesView({ result, onChange }: { result: GenerationResult; onChange: (notes: Note[], key?: string) => void }) {
  const notes = result.notes;
  const add = () => onChange([...notes, { kind: "assumption", label: result.language === "id" ? "Asumsi" : "Assumption", detail: "" }]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted">Questions to take back to the BA. They export to the Note sheet, so edit them before downloading.</p>
        <Button size="sm" icon="plus" onClick={add}>
          Add assumption
        </Button>
      </div>
      {(["correction", "assumption", "dedup", "source"] as NoteKind[]).map((kind) => {
        const items = notes.map((n, i) => ({ n, i })).filter(({ n }) => n.kind === kind);
        if (!items.length) return null;
        return (
          <Card key={kind} className="p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {NOTE_TITLES[kind]} <span className="font-normal">({items.length})</span>
            </h3>
            <ul className="divide-y divide-line">
              {items.map(({ n, i }) => (
                <li key={i} className="group flex flex-col gap-1 py-2 sm:flex-row sm:gap-3">
                  <input
                    aria-label="Note label"
                    className="w-full shrink-0 rounded-md bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:bg-subtle focus:bg-surface focus:ring-2 focus:ring-accent/40 sm:w-36"
                    value={n.label}
                    onChange={(e) => onChange(notes.map((m, j) => (j === i ? { ...m, label: e.target.value } : m)), `note${i}:label`)}
                  />
                  <textarea
                    aria-label="Note detail"
                    className="w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-sm leading-snug outline-none hover:bg-subtle focus:bg-surface focus:ring-2 focus:ring-accent/40"
                    rows={Math.max(1, Math.ceil(n.detail.length / 100))}
                    value={n.detail}
                    placeholder="Detail"
                    onChange={(e) => onChange(notes.map((m, j) => (j === i ? { ...m, detail: e.target.value } : m)), `note${i}:detail`)}
                  />
                  <IconButton icon="trash" label="Delete note" className="self-start opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onChange(notes.filter((_, j) => j !== i))} />
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      {!notes.length && <Card className="p-8 text-center text-sm text-muted">No notes. The model had no corrections or assumptions for this requirement.</Card>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
const META_FIELDS: { k: keyof ExportMeta; label: string; placeholder: string }[] = [
  { k: "project_name", label: "Project name", placeholder: "Shown in the workbook header" },
  { k: "project_no", label: "Project number", placeholder: "Optional" },
  { k: "created_by", label: "Created by", placeholder: "Your name" },
];

export function ExportView({ result, meta, setMeta, onExport }: { result: GenerationResult; meta: ExportMeta; setMeta: (m: ExportMeta) => void; onExport: (f: "xlsx" | "csv") => Promise<void> }) {
  const [busy, setBusy] = useState<"xlsx" | "csv" | null>(null);
  const run = async (f: "xlsx" | "csv") => {
    setBusy(f);
    try {
      await onExport(f);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="font-semibold">Workbook details</h3>
        {META_FIELDS.map(({ k, label, placeholder }) => (
          <div key={k}>
            <label className={labelCls}>{label}</label>
            <input className={inputCls} value={meta[k]} placeholder={placeholder} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} />
          </div>
        ))}
        <Button variant="success" size="lg" icon="download" className="mt-2" onClick={() => run("xlsx")} disabled={busy !== null}>
          {busy === "xlsx" ? "Preparing…" : "Download XLSX"}
        </Button>
        <p className="-mt-1 text-center text-[11px] text-muted">RTM · Test Script · Defect List · Note</p>
        <Button icon="download" onClick={() => run("csv")} disabled={busy !== null}>
          {busy === "csv" ? "Preparing…" : "Download CSV (script only)"}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-semibold">Requirement traceability (RTM)</h3>
          <p className="text-xs text-muted">One row per group. Execution columns start at zero for the tester to fill in.</p>
        </div>
        {result.rtm.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-left text-[11px] tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2">Req</th>
                  <th className="px-4 py-2">Requirement</th>
                  <th className="px-4 py-2 text-right">Cases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rtm.map((r) => (
                  <tr key={r.req_no} className="align-top">
                    <td className="px-4 py-2 font-mono text-xs">{r.req_no}</td>
                    <td className="px-4 py-2">{r.requirement}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.total_case}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted">RTM sheet is turned off for this script (see "More options" in the input).</p>
        )}
      </Card>
    </div>
  );
}
