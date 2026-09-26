import { useCallback, useEffect, useRef, useState } from "react";
import { exportFile, fetchJira, generate, getHealth, recompute, regenerateCase, withUids } from "./api";
import { InputPanel, MIN_REQ, PREFIX_RE } from "./components/InputPanel";
import { RegenerateModal } from "./components/RegenerateModal";
import { CoverageView, ExportView, NotesView, SummaryCards } from "./components/ResultViews";
import { EmptyState, ErrorAlert, GeneratingState, WarningList } from "./components/States";
import { TopBar } from "./components/TopBar";
import { useElapsed, useHistory, useTheme } from "./hooks";
import { EMPTY } from "./samples";
import { ScriptTable } from "./ScriptTable";
import type { ExportMeta, GenerateRequest, GenerationResult, Health, TestCase } from "./types";
import { Badge, Button, Modal, Tabs, useToast } from "./ui";

const STORAGE = "testcase-maker:v2";
const LEGACY_STORAGE = "testcase-maker:v1"; // sessionStorage, before results survived closing the tab
const EMPTY_META: ExportMeta = { project_name: "", project_no: "", created_by: "" };

type Saved = { form: GenerateRequest; result: GenerationResult | null; meta: ExportMeta };
type TabId = "script" | "coverage" | "notes" | "export";

/** Restore the last session. Anything malformed (older shape, hand-edited storage) falls back to empty. */
function load(): Saved {
  const empty: Saved = { form: EMPTY, result: null, meta: EMPTY_META };
  try {
    const raw = localStorage.getItem(STORAGE) ?? sessionStorage.getItem(LEGACY_STORAGE);
    if (!raw) return empty;
    const s = JSON.parse(raw);
    const r = s?.result;
    return {
      form: typeof s?.form?.requirement_text === "string" ? { ...EMPTY, ...s.form } : EMPTY,
      result: r && Array.isArray(r.groups) && Array.isArray(r.acceptance_criteria) && r.stats ? withUids(r) : null,
      meta: { ...EMPTY_META, ...s?.meta },
    };
  } catch {
    return empty;
  }
}

const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export default function App() {
  const [initial] = useState(load);
  const [form, setForm] = useState(initial.form);
  const history = useHistory<GenerationResult | null>(initial.result);
  const result = history.value;
  const [meta, setMeta] = useState(initial.meta);
  const [health, setHealth] = useState<Health | null>(null);
  const [theme, setTheme] = useTheme();
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(busy);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(!!initial.result);
  const [tab, setTab] = useState<TabId>("script");
  const [regenTarget, setRegenTarget] = useState<TestCase | null>(null);
  const [regenBusy, setRegenBusy] = useState<string | null>(null);
  const [focusUid, setFocusUid] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(result);
  latest.current = result;
  const toast = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ form, result, meta }));
    } catch {
      /* storage full or blocked: the session still works, it just won't survive a reload */
    }
  }, [form, result, meta]);

  // Jira control only appears when the server has credentials. The public demo has none.
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const set = (r: GenerationResult, key?: string) => history.set(r, key);

  async function onFetchJira(key: string) {
    setError(null);
    setNotice([]);
    try {
      const t = await fetchJira(key);
      setForm((f) => ({ ...f, story_key: t.story_key, story_title: t.story_title, story_url: t.story_url, requirement_text: t.requirement_text }));
      setNotice(t.warnings);
      toast(`Imported ${t.story_key}`, { tone: "success" });
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  async function onGenerate() {
    if (busy || form.requirement_text.trim().length < MIN_REQ || !form.system_under_test.trim() || !PREFIX_RE.test(form.req_prefix)) return;
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    setError(null);
    try {
      const nullable = (v: string | null) => (v?.trim() ? v : null);
      const r = await generate({ ...form, story_key: nullable(form.story_key), story_title: nullable(form.story_title), story_url: nullable(form.story_url) }, ac.signal);
      history.set(r); // not reset: undo brings back the previous script
      setMeta((m) => ({ ...m, project_name: m.project_name || form.story_title || "" }));
      setCollapsed(true);
      setTab("script");
      toast(`Generated ${r.stats.total_cases} test cases`, { tone: "success" });
    } catch (e) {
      if ((e as Error).name === "AbortError") toast("Generation cancelled");
      else setError(String((e as Error).message));
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }
  const generateRef = useRef(onGenerate);
  generateRef.current = onGenerate;

  async function onRegenerate(instruction: string) {
    const target = regenTarget;
    if (!target || !result) return;
    setRegenTarget(null);
    setRegenBusy(target.tc_id);
    setError(null);
    try {
      const fresh = await regenerateCase(target.tc_id, form.requirement_text, instruction || null, result);
      // The user may have kept editing while this ran, so patch the latest script, matching by uid.
      const now = latest.current;
      if (!now || !now.groups.some((g) => g.test_cases.some((c) => c.uid === target.uid))) {
        toast(`${target.tc_id} was removed before the new version arrived`, { tone: "error" });
        return;
      }
      history.set(
        recompute({
          ...now,
          groups: now.groups.map((g) => ({ ...g, test_cases: g.test_cases.map((c) => (c.uid === target.uid ? { ...fresh, uid: target.uid } : c)) })),
        }),
      );
      toast(`${target.tc_id} regenerated`, { tone: "success", action: { label: "Undo", onClick: history.undo } });
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
      toast(`${format.toUpperCase()} downloaded`, { tone: "success" });
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  function onNewScript() {
    setConfirmNew(false);
    abort.current?.abort();
    setForm(EMPTY);
    history.reset(null);
    setMeta(EMPTY_META);
    setError(null);
    setNotice([]);
    setCollapsed(false);
    setTab("script");
  }

  const onFocused = useCallback(() => setFocusUid(null), []);

  // Keyboard: Ctrl/Cmd+Enter generates from the input; Ctrl+Z / Ctrl+Shift+Z undo script edits
  // (inside a text field the browser's own undo applies instead).
  const { undo, redo } = history;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "Enter" && !collapsed) {
        e.preventDefault();
        generateRef.current();
      } else if (!isEditable(e.target) && (e.key === "z" || e.key === "Z" || e.key === "y")) {
        e.preventDefault();
        if (e.key === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, undo, redo]);

  const s = result?.stats;

  return (
    <div className="min-h-screen">
      <TopBar health={health} theme={theme} onTheme={setTheme} onNew={() => setConfirmNew(true)} canReset={!!result || form.requirement_text !== ""} />

      <main className="mx-auto max-w-[1680px] space-y-4 px-4 py-5">
        <InputPanel
          form={form}
          setForm={setForm}
          collapsed={collapsed && !!result}
          setCollapsed={setCollapsed}
          jiraOn={!!health?.jira}
          onFetchJira={onFetchJira}
          busy={busy}
          elapsed={elapsed}
          onGenerate={onGenerate}
          onCancel={() => abort.current?.abort()}
          hasResult={!!result}
        />

        {notice.length > 0 && <WarningList title="notes from the Jira import" items={notice} defaultOpen />}
        {error && <ErrorAlert error={error} onDismiss={() => setError(null)} />}

        {busy ? (
          <GeneratingState elapsed={elapsed} />
        ) : !result || !s ? (
          <EmptyState />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-x-4">
              <div className="min-w-0 flex-1">
                <Tabs<TabId>
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { id: "script", label: "Script", badge: <Badge>{s.total_cases}</Badge> },
                    {
                      id: "coverage",
                      label: "Coverage",
                      badge: (
                        <Badge tone={s.ac_uncovered.length ? "rose" : "emerald"}>
                          {s.ac_covered}/{s.ac_total}
                        </Badge>
                      ),
                    },
                    { id: "notes", label: "Notes", badge: result.notes.length ? <Badge>{result.notes.length}</Badge> : undefined },
                    { id: "export", label: "Export" },
                  ]}
                />
              </div>
              <p className="hidden pb-2 font-mono text-[11px] text-muted xl:block" title="Generation id · model · created at">
                {result.generation_id} · {result.model} · {result.created_at}
              </p>
            </div>

            {tab === "script" && (
              <>
                <SummaryCards result={result} onCoverage={() => setTab("coverage")} />
                <WarningList title={result.warnings.length === 1 ? "validation warning" : "validation warnings"} items={result.warnings} />
                <ScriptTable
                  result={result}
                  onChange={set}
                  onRegenerate={setRegenTarget}
                  onDeleted={(msg) => toast(msg, { action: { label: "Undo", onClick: undo } })}
                  regenBusy={regenBusy}
                  focusUid={focusUid}
                  onFocused={onFocused}
                  history={history}
                />
              </>
            )}
            {tab === "coverage" && (
              <CoverageView
                result={result}
                onJump={(c) => {
                  setTab("script");
                  setFocusUid(c.uid ?? null);
                }}
              />
            )}
            {tab === "notes" && <NotesView result={result} onChange={(notes, key) => set({ ...result, notes }, key)} />}
            {tab === "export" && <ExportView result={result} meta={meta} setMeta={setMeta} onExport={onExport} />}
          </section>
        )}
      </main>

      {regenTarget && <RegenerateModal tc={regenTarget} onSubmit={onRegenerate} onClose={() => setRegenTarget(null)} />}
      {confirmNew && (
        <Modal
          title="Start a new script?"
          onClose={() => setConfirmNew(false)}
          footer={
            <>
              <Button onClick={() => setConfirmNew(false)}>Keep working</Button>
              <Button variant="danger" onClick={onNewScript}>
                Clear everything
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">This clears the requirement, the generated script and your edits. Export first if you want to keep them.</p>
        </Modal>
      )}
    </div>
  );
}
