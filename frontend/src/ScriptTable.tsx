import { Fragment } from "react";
import { recompute } from "./api";
import { CASE_CLASSES, PRIORITIES, TEST_TYPES, type GenerationResult, type TestCase } from "./types";

const CLASS_STYLE = {
  positive: "bg-emerald-50 text-emerald-800 border-emerald-200",
  negative: "bg-rose-50 text-rose-800 border-rose-200",
  boundary: "bg-amber-50 text-amber-800 border-amber-200",
};

const rowsFor = (v: string, width: number) =>
  Math.max(1, v.split("\n").reduce((n, l) => n + Math.ceil(Math.max(1, l.length) / width), 0));

function Cell({ value, onChange, width = 40, mono = false }: { value: string; onChange: (v: string) => void; width?: number; mono?: boolean }) {
  return (
    <textarea
      className={`w-full resize-none rounded bg-transparent p-1 leading-snug outline-none hover:bg-white focus:bg-white focus:ring-1 focus:ring-sky-400 ${mono ? "font-mono text-xs" : ""}`}
      rows={rowsFor(value, width)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Select<T extends string>({ value, options, onChange, className = "" }: { value: T; options: T[]; onChange: (v: T) => void; className?: string }) {
  return (
    <select className={`rounded border px-1 py-0.5 text-xs ${className}`} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const Btn = ({ title, onClick, children, disabled = false }: { title: string; onClick: () => void; children: string; disabled?: boolean }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs leading-none hover:bg-slate-100 disabled:opacity-40"
  >
    {children}
  </button>
);

interface Props {
  result: GenerationResult;
  onChange: (r: GenerationResult) => void;
  onRegenerate: (tc_id: string) => void;
  regenBusy: string | null;
}

export function ScriptTable({ result, onChange, onRegenerate, regenBusy }: Props) {
  const withGroups = (fn: (groups: GenerationResult["groups"]) => void) => {
    const groups = result.groups.map((g) => ({ ...g, test_cases: g.test_cases.map((c) => ({ ...c })) }));
    fn(groups);
    onChange(recompute({ ...result, groups }));
  };
  const patch = (gi: number, ci: number, p: Partial<TestCase>) => withGroups((g) => Object.assign(g[gi].test_cases[ci], p));
  const move = (gi: number, ci: number, d: -1 | 1) =>
    withGroups((g) => {
      const list = g[gi].test_cases;
      const j = ci + d;
      if (j < 0 || j >= list.length) return;
      [list[ci], list[j]] = [list[j], list[ci]];
    });
  const remove = (gi: number, ci: number) => {
    if (!confirm(`Delete ${result.groups[gi].test_cases[ci].tc_id}?`)) return;
    withGroups((g) => g[gi].test_cases.splice(ci, 1));
  };
  const uncovered = new Set(result.stats.ac_uncovered);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1500px] table-fixed border-collapse text-sm">
        <colgroup>
          {[80, 260, 90, 80, 100, 220, 300, 300, 60, 90].map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-sky-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
          <tr>
            {["TC ID", "Title / Description", "Class", "Priority", "Type", "Precondition", "Test Steps", "Expected Result", "AC", ""].map((h) => (
              <th key={h} className="border-b border-slate-200 px-2 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="align-top">
          {result.groups.map((g, gi) => (
            <Fragment key={g.req_no}>
              <tr className="bg-amber-50">
                <td colSpan={10} className="border-y border-amber-200 px-2 py-1 font-semibold text-amber-900">
                  <span className="mr-2 font-mono text-xs text-amber-700">{g.req_no}</span>
                  -- Group {g.group_no}:{" "}
                  <input
                    className="w-3/4 rounded bg-transparent px-1 outline-none hover:bg-white focus:bg-white focus:ring-1 focus:ring-sky-400"
                    value={g.group_label}
                    onChange={(e) => withGroups((gs) => (gs[gi].group_label = e.target.value))}
                  />{" "}
                  --
                </td>
              </tr>
              {g.test_cases.map((c, ci) => (
                <tr key={c.tc_id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                  <td className="px-2 py-1 font-mono text-xs font-semibold">{c.tc_id}</td>
                  <td className="px-1 py-1">
                    <Cell value={c.title} onChange={(v) => patch(gi, ci, { title: v })} width={38} />
                  </td>
                  <td className="px-1 py-1">
                    <Select value={c.case_class} options={CASE_CLASSES} onChange={(v) => patch(gi, ci, { case_class: v })} className={CLASS_STYLE[c.case_class]} />
                    <div className="mt-0.5 text-[10px] text-slate-500">{c.pos_neg}</div>
                  </td>
                  <td className="px-1 py-1">
                    <Select value={c.priority} options={PRIORITIES} onChange={(v) => patch(gi, ci, { priority: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <Select value={c.type} options={TEST_TYPES} onChange={(v) => patch(gi, ci, { type: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <Cell value={c.precondition} onChange={(v) => patch(gi, ci, { precondition: v })} width={32} />
                  </td>
                  <td className="px-1 py-1">
                    <Cell
                      value={c.test_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
                      onChange={(v) =>
                        patch(gi, ci, {
                          test_steps: v
                            .split("\n")
                            .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
                            .filter(Boolean),
                        })
                      }
                      width={44}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Cell value={c.expected_result} onChange={(v) => patch(gi, ci, { expected_result: v })} width={44} />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      className={`w-full rounded px-1 font-mono text-xs outline-none focus:ring-1 focus:ring-sky-400 ${uncovered.has(c.requirement_ref) ? "bg-rose-50" : "bg-transparent"}`}
                      value={c.requirement_ref}
                      onChange={(e) => patch(gi, ci, { requirement_ref: e.target.value.trim() })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex flex-wrap gap-1">
                      <Btn title="Move up" onClick={() => move(gi, ci, -1)} disabled={ci === 0}>
                        ↑
                      </Btn>
                      <Btn title="Move down" onClick={() => move(gi, ci, 1)} disabled={ci === g.test_cases.length - 1}>
                        ↓
                      </Btn>
                      <Btn title="Regenerate this case with the rest of the script as context" onClick={() => onRegenerate(c.tc_id)} disabled={regenBusy !== null}>
                        {regenBusy === c.tc_id ? "…" : "↻"}
                      </Btn>
                      <Btn title="Delete" onClick={() => remove(gi, ci)}>
                        ✕
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
