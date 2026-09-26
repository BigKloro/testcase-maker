import { Fragment, useEffect, useMemo, useState } from "react";
import { newUid, recompute } from "./api";
import { CASE_CLASSES, PRIORITIES, TEST_TYPES, type CaseClass, type GenerationResult, type Group, type Priority, type TestCase } from "./types";
import { Button, cx, Icon, IconButton, Menu } from "./ui";

export const CLASS_STYLE: Record<CaseClass, string> = {
  positive: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
  negative: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
  boundary: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
};
const PRIORITY_STYLE: Record<Priority, string> = {
  High: "text-rose-700 dark:text-rose-300",
  Medium: "text-amber-700 dark:text-amber-300",
  Low: "text-muted",
};

const rowsFor = (v: string, width: number) => Math.max(1, v.split("\n").reduce((n, l) => n + Math.ceil(Math.max(1, l.length) / width), 0));

type Density = "full" | "compact";

function Cell({ value, onChange, width = 40, density, placeholder }: { value: string; onChange: (v: string) => void; width?: number; density: Density; placeholder?: string }) {
  const rows = rowsFor(value, width);
  return (
    <textarea
      className="w-full resize-none rounded-md bg-transparent p-1 leading-snug outline-none placeholder:text-muted/60 hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-accent/40"
      rows={density === "compact" ? Math.min(rows, 2) : rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Select<T extends string>({ value, options, onChange, className = "", title }: { value: T; options: readonly T[]; onChange: (v: T) => void; className?: string; title?: string }) {
  return (
    <select
      title={title}
      className={cx("w-full cursor-pointer rounded-md border border-line bg-surface px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent/40", className)}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors",
        active ? "border-accent bg-accent-soft text-accent-strong dark:text-accent" : "border-line text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** A blank case pre-filled with what the validator requires, so an added row is export-ready once filled in. */
function blankCase(r: GenerationResult, g: Group | undefined): TestCase {
  const first = g?.test_cases[0];
  return {
    uid: newUid(),
    tc_id: "",
    title: "",
    pos_neg: "Negative",
    case_class: "negative",
    priority: first?.priority ?? "Medium",
    type: first?.type ?? "Functional",
    precondition: "",
    test_steps: [r.language === "id" ? "Login ke aplikasi" : "Log in to the application"],
    expected_result: "",
    requirement_ref: first?.requirement_ref ?? r.acceptance_criteria[0]?.id ?? "",
    status: "",
    tested_by: "",
    execution_date: null,
    notes: "",
  };
}

interface Props {
  result: GenerationResult;
  /** coalesceKey groups rapid edits to one field into a single undo step. */
  onChange: (r: GenerationResult, coalesceKey?: string) => void;
  onRegenerate: (c: TestCase) => void;
  onDeleted: (label: string) => void;
  regenBusy: string | null;
  focusUid: string | null;
  onFocused: () => void;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
}

const COLS = [
  ["TC ID", 96],
  ["Title / Description", 260],
  ["Class", 118],
  ["Priority", 92],
  ["Type", 118],
  ["Precondition", 210],
  ["Test Steps", 300],
  ["Expected Result", 290],
  ["AC", 88],
  ["", 72],
] as const;

export function ScriptTable({ result, onChange, onRegenerate, onDeleted, regenBusy, focusUid, onFocused, history }: Props) {
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<Set<CaseClass>>(new Set());
  const [priorities, setPriorities] = useState<Set<Priority>>(new Set());
  const [density, setDensity] = useState<Density>("full");
  const [flash, setFlash] = useState<string | null>(null);

  const filtering = query.trim() !== "" || classes.size > 0 || priorities.size > 0;
  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (c: TestCase) =>
      (!classes.size || classes.has(c.case_class)) &&
      (!priorities.size || priorities.has(c.priority)) &&
      (!q || [c.tc_id, c.title, c.precondition, c.expected_result, c.requirement_ref, ...c.test_steps].some((t) => t.toLowerCase().includes(q)));
  }, [query, classes, priorities]);

  // Jump-to-row from the Coverage tab: clear filters so the row exists, scroll, flash.
  useEffect(() => {
    if (!focusUid) return;
    setQuery("");
    setClasses(new Set());
    setPriorities(new Set());
    requestAnimationFrame(() => {
      document.getElementById(`row-${focusUid}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      setFlash(focusUid);
      setTimeout(() => setFlash(null), 1600);
    });
    onFocused();
  }, [focusUid, onFocused]);

  const withGroups = (fn: (groups: Group[]) => void, key?: string) => {
    const groups = result.groups.map((g) => ({ ...g, test_cases: g.test_cases.map((c) => ({ ...c })) }));
    fn(groups);
    onChange(recompute({ ...result, groups: groups.filter((g) => g.test_cases.length > 0) }), key);
  };
  const patch = (gi: number, ci: number, p: Partial<TestCase>, field: string) =>
    withGroups((g) => Object.assign(g[gi].test_cases[ci], p), `${result.groups[gi].test_cases[ci].uid}:${field}`);
  const move = (gi: number, ci: number, d: -1 | 1) =>
    withGroups((g) => {
      const list = g[gi].test_cases;
      const j = ci + d;
      if (j < 0 || j >= list.length) return;
      [list[ci], list[j]] = [list[j], list[ci]];
    });
  const duplicate = (gi: number, ci: number) =>
    withGroups((g) => {
      const src = g[gi].test_cases[ci];
      g[gi].test_cases.splice(ci + 1, 0, { ...src, uid: newUid(), test_steps: [...src.test_steps] });
    });
  const remove = (gi: number, ci: number) => {
    const id = result.groups[gi].test_cases[ci].tc_id;
    withGroups((g) => g[gi].test_cases.splice(ci, 1));
    onDeleted(`${id} deleted`);
  };
  const removeGroup = (gi: number) => {
    const label = `Group ${result.groups[gi].group_no}`;
    withGroups((g) => g.splice(gi, 1));
    onDeleted(`${label} deleted`);
  };
  const addCase = (gi: number) => {
    const c = blankCase(result, result.groups[gi]);
    withGroups((g) => g[gi].test_cases.push(c));
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`#row-${c.uid} textarea`)?.focus(), 50);
  };
  const addGroup = () => {
    const c = blankCase(result, undefined);
    const req_no = result.groups[0]?.req_no ?? "TC-01";
    withGroups((g) => g.push({ uid: newUid(), group_no: 0, group_label: result.language === "id" ? "Grup baru" : "New group", req_no, test_cases: [c] }));
    setTimeout(() => document.getElementById(`row-${c.uid}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  };

  const acIds = result.acceptance_criteria.map((a) => a.id);
  const acText = Object.fromEntries(result.acceptance_criteria.map((a) => [a.id, a.text]));
  const uncovered = new Set(result.stats.ac_uncovered);
  const visibleCount = result.groups.reduce((n, g) => n + g.test_cases.filter(matches).length, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      {/* ---------------- toolbar ---------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <label className="relative min-w-48 flex-1 sm:max-w-72">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <input
            className="h-8 w-full rounded-md border border-line bg-surface pr-2 pl-8 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            placeholder="Search cases"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {CASE_CLASSES.map((c) => (
            <Chip key={c} active={classes.has(c)} onClick={() => setClasses((s) => toggle(s, c))}>
              {c}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          {PRIORITIES.map((p) => (
            <Chip key={p} active={priorities.has(p)} onClick={() => setPriorities((s) => toggle(s, p))}>
              {p}
            </Chip>
          ))}
          {filtering && (
            <button
              type="button"
              className="ml-1 text-xs text-accent hover:underline"
              onClick={() => {
                setQuery("");
                setClasses(new Set());
                setPriorities(new Set());
              }}
            >
              Clear · {visibleCount} shown
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon="undo" label="Undo (Ctrl+Z)" onClick={history.undo} disabled={!history.canUndo} />
          <IconButton icon="redo" label="Redo (Ctrl+Shift+Z)" onClick={history.redo} disabled={!history.canRedo} />
          <IconButton
            icon={density === "full" ? "compress" : "rows"}
            label={density === "full" ? "Compact rows" : "Expand rows"}
            onClick={() => setDensity((d) => (d === "full" ? "compact" : "full"))}
          />
          <Button size="sm" icon="plus" onClick={addGroup}>
            Group
          </Button>
        </div>
      </div>

      {/* ---------------- table ---------------- */}
      <div className="max-h-[calc(100vh-15rem)] min-h-64 overflow-auto">
        <table className="w-full min-w-[1644px] table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            {COLS.map(([, w], i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 text-left text-[11px] font-semibold tracking-wide text-muted uppercase">
            <tr>
              {COLS.map(([h], i) => (
                <th key={i} className={cx("border-b border-line bg-subtle px-2 py-2", i === 0 && "sticky left-0 z-10")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="align-top">
            {result.groups.map((g, gi) => {
              const cases = g.test_cases.map((c, ci) => ({ c, ci })).filter(({ c }) => matches(c));
              if (filtering && !cases.length) return null;
              return (
                <Fragment key={g.uid ?? g.req_no}>
                  <tr className="group/g">
                    <td colSpan={COLS.length} className="border-b border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                      <div className="sticky left-2 flex max-w-[calc(100vw-4rem)] items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                        <span className="font-mono text-xs text-amber-700 dark:text-amber-400">{g.req_no}</span>
                        <span className="hidden shrink-0 sm:inline">Group {g.group_no}:</span>
                        <input
                          aria-label={`Group ${g.group_no} label`}
                          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 outline-none hover:bg-surface/70 focus:bg-surface focus:ring-2 focus:ring-accent/40"
                          value={g.group_label}
                          onChange={(e) => withGroups((gs) => (gs[gi].group_label = e.target.value), `${g.uid}:label`)}
                        />
                        <span className="hidden shrink-0 text-xs font-normal text-amber-800/70 sm:inline dark:text-amber-300/70">{g.test_cases.length} cases</span>
                        <IconButton icon="plus" label="Add a case to this group" onClick={() => addCase(gi)} />
                        <IconButton icon="trash" label="Delete group" className="opacity-0 group-hover/g:opacity-100 focus:opacity-100" onClick={() => removeGroup(gi)} />
                      </div>
                    </td>
                  </tr>
                  {cases.map(({ c, ci }) => (
                    <tr
                      key={c.uid ?? c.tc_id}
                      id={`row-${c.uid}`}
                      className={cx("group/r bg-surface even:bg-stripe hover:bg-hover", flash === c.uid && "row-flash", regenBusy === c.tc_id && "animate-pulse")}
                    >
                      <td className="sticky left-0 z-10 border-b border-line bg-inherit px-2 py-2">
                        <div className="font-mono text-xs font-semibold">{c.tc_id}</div>
                        <div className={cx("mt-1 text-[11px] font-medium", c.pos_neg === "Positive" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>{c.pos_neg}</div>
                      </td>
                      <td className="border-b border-line px-1 py-1">
                        <Cell value={c.title} onChange={(v) => patch(gi, ci, { title: v }, "title")} width={36} density={density} placeholder="Title" />
                      </td>
                      <td className="border-b border-line px-1 py-1.5">
                        <Select value={c.case_class} options={CASE_CLASSES} onChange={(v) => patch(gi, ci, { case_class: v }, "class")} className={cx("capitalize", CLASS_STYLE[c.case_class])} />
                      </td>
                      <td className="border-b border-line px-1 py-1.5">
                        <Select value={c.priority} options={PRIORITIES} onChange={(v) => patch(gi, ci, { priority: v }, "priority")} className={cx("font-medium", PRIORITY_STYLE[c.priority])} />
                      </td>
                      <td className="border-b border-line px-1 py-1.5">
                        <Select value={c.type} options={TEST_TYPES} onChange={(v) => patch(gi, ci, { type: v }, "type")} />
                      </td>
                      <td className="border-b border-line px-1 py-1">
                        <Cell value={c.precondition} onChange={(v) => patch(gi, ci, { precondition: v }, "pre")} width={30} density={density} placeholder="None" />
                      </td>
                      <td className="border-b border-line px-1 py-1">
                        <Cell
                          value={c.test_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
                          onChange={(v) =>
                            patch(
                              gi,
                              ci,
                              {
                                test_steps: v
                                  .split("\n")
                                  .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
                                  .filter(Boolean),
                              },
                              "steps",
                            )
                          }
                          width={42}
                          density={density}
                        />
                      </td>
                      <td className="border-b border-line px-1 py-1">
                        <Cell value={c.expected_result} onChange={(v) => patch(gi, ci, { expected_result: v }, "expected")} width={42} density={density} placeholder="Expected result" />
                      </td>
                      <td className="border-b border-line px-1 py-1.5">
                        <Select
                          title={acText[c.requirement_ref] ?? "Not in the extracted AC list"}
                          value={c.requirement_ref}
                          options={acIds.includes(c.requirement_ref) ? acIds : [c.requirement_ref, ...acIds]}
                          onChange={(v) => patch(gi, ci, { requirement_ref: v }, "ac")}
                          className={cx("font-mono", (!acIds.includes(c.requirement_ref) || uncovered.has(c.requirement_ref)) && "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300")}
                        />
                      </td>
                      <td className="border-b border-line px-1 py-1.5">
                        <div className="flex items-center justify-end">
                          <div className="flex flex-col opacity-0 transition-opacity group-hover/r:opacity-100 focus-within:opacity-100">
                            <IconButton icon="chevronUp" label="Move up" className="h-5" onClick={() => move(gi, ci, -1)} disabled={ci === 0} />
                            <IconButton icon="chevronDown" label="Move down" className="h-5" onClick={() => move(gi, ci, 1)} disabled={ci === g.test_cases.length - 1} />
                          </div>
                          <Menu
                            label={`Actions for ${c.tc_id}`}
                            items={[
                              { label: "Regenerate…", icon: "sparkle", onSelect: () => onRegenerate(c), disabled: regenBusy !== null },
                              { label: "Duplicate", icon: "copy", onSelect: () => duplicate(gi, ci) },
                              { label: "Insert below", icon: "plus", onSelect: () => withGroups((gs) => gs[gi].test_cases.splice(ci + 1, 0, blankCase(result, g))) },
                              { label: "Delete", icon: "trash", danger: true, onSelect: () => remove(gi, ci) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtering && visibleCount === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No cases match these filters.</p>}
        {!result.groups.length && (
          <div className="px-4 py-10 text-center text-sm text-muted">
            The script is empty. <button type="button" className="text-accent hover:underline" onClick={addGroup}>Add a group</button> or undo.
          </div>
        )}
      </div>
    </div>
  );
}
