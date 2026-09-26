import { useState } from "react";
import { SAMPLES } from "../samples";
import { PRIORITIES, TEST_TYPES, type GenerateRequest } from "../types";
import { Badge, Button, Card, cx, Icon, inputCls, labelCls } from "../ui";

const SUT_OPTIONS = ["PEGA", "T24", "CardPerfect", "Web App", "REST API"];
export const PREFIX_RE = /^TC-\d{2}$/;
export const MIN_REQ = 40;

interface Props {
  form: GenerateRequest;
  setForm: (f: GenerateRequest) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  jiraOn: boolean;
  onFetchJira: (key: string) => Promise<void>;
  busy: boolean;
  elapsed: number;
  onGenerate: () => void;
  onCancel: () => void;
  hasResult: boolean;
}

export function InputPanel({ form, setForm, collapsed, setCollapsed, jiraOn, onFetchJira, busy, elapsed, onGenerate, onCancel, hasResult }: Props) {
  const [jiraKey, setJiraKey] = useState("");
  const [jiraBusy, setJiraBusy] = useState(false);
  const [more, setMore] = useState(false);
  const set = <K extends keyof GenerateRequest>(k: K, v: GenerateRequest[K]) => setForm({ ...form, [k]: v });

  const len = form.requirement_text.trim().length;
  const prefixOk = PREFIX_RE.test(form.req_prefix);
  const blocker = len < MIN_REQ ? `Requirement needs at least ${MIN_REQ} characters` : !form.system_under_test.trim() ? "Pick a system under test" : !prefixOk ? "TC ID prefix must look like TC-01" : null;

  if (collapsed) {
    return (
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Badge tone="accent" className="order-first">
          {form.system_under_test || "No SUT"}
        </Badge>
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <p className="truncate text-sm font-medium">
            {form.story_key && <span className="mr-2 font-mono text-xs text-muted">{form.story_key}</span>}
            {form.story_title || form.requirement_text.slice(0, 120) || "No requirement"}
          </p>
          <p className="text-xs text-muted">
            {form.requirement_text.length.toLocaleString()} characters · {form.language === "id" ? "Bahasa Indonesia" : "English"} · target {form.target_case_count ?? "auto"}
          </p>
        </div>
        <Button size="sm" icon="edit" onClick={() => setCollapsed(false)}>
          Edit input
        </Button>
        <Button size="sm" variant="primary" icon="refresh" onClick={onGenerate} disabled={busy || !!blocker}>
          Regenerate all
        </Button>
      </Card>
    );
  }

  const fetchJira = async () => {
    if (!jiraKey.trim()) return;
    setJiraBusy(true);
    try {
      await onFetchJira(jiraKey);
    } finally {
      setJiraBusy(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 font-semibold">Requirement</h2>
        <span className="text-xs text-muted">Try a sample:</span>
        {SAMPLES.map((smp) => (
          <Button key={smp.label} size="sm" variant="ghost" className="border border-dashed border-line" onClick={() => setForm(smp.req)}>
            {smp.label}
          </Button>
        ))}
        {hasResult && (
          <Button size="sm" variant="ghost" icon="chevronUp" className="ml-auto" onClick={() => setCollapsed(true)}>
            Collapse
          </Button>
        )}
      </div>

      {jiraOn && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-subtle p-2">
          <span className="px-1 text-xs font-medium text-muted">Import from Jira</span>
          <input
            className={cx(inputCls, "h-8 max-w-72 flex-1 py-1")}
            value={jiraKey}
            onChange={(e) => setJiraKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchJira()}
            placeholder="DEMO-5385 or a browse URL"
          />
          <Button size="sm" onClick={fetchJira} disabled={jiraBusy || !jiraKey.trim()}>
            {jiraBusy ? "Fetching…" : "Fetch"}
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col">
          <label htmlFor="req" className={labelCls}>
            User story, description or acceptance criteria
          </label>
          <textarea
            id="req"
            className={cx(inputCls, "min-h-[260px] flex-1 resize-y font-mono text-[13px] leading-relaxed")}
            value={form.requirement_text}
            onChange={(e) => set("requirement_text", e.target.value)}
            placeholder="Paste the Jira description or AC list here."
            maxLength={20000}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>{len > 0 && len < MIN_REQ ? `${MIN_REQ - len} more characters needed` : "Ctrl+Enter to generate"}</span>
            <span>{form.requirement_text.length.toLocaleString()} / 20,000</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>System under test</label>
            <input className={inputCls} list="sut" value={form.system_under_test} onChange={(e) => set("system_under_test", e.target.value)} />
            <datalist id="sut">
              {SUT_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Story key</label>
              <input className={inputCls} value={form.story_key ?? ""} onChange={(e) => set("story_key", e.target.value)} placeholder="DEMO-5385" />
            </div>
            <div>
              <label className={labelCls}>Language</label>
              <select className={inputCls} value={form.language} onChange={(e) => set("language", e.target.value as GenerateRequest["language"])}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Story title</label>
            <input className={inputCls} value={form.story_title ?? ""} onChange={(e) => set("story_title", e.target.value)} />
          </div>

          <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 self-start text-xs font-medium text-accent hover:underline">
            <Icon name={more ? "chevronUp" : "chevronDown"} className="size-3.5" /> {more ? "Fewer options" : "More options"}
            {!more && !prefixOk && <span className="ml-1 text-rose-600">(fix TC prefix)</span>}
          </button>
          {more && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3">
              <div className="col-span-2">
                <label className={labelCls}>Story URL (goes to the Note sheet)</label>
                <input className={inputCls} value={form.story_url ?? ""} onChange={(e) => set("story_url", e.target.value)} placeholder="https://…/browse/KEY-123" />
              </div>
              <div>
                <label className={labelCls}>TC ID prefix</label>
                <input
                  className={cx(inputCls, !prefixOk && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/25")}
                  value={form.req_prefix}
                  onChange={(e) => set("req_prefix", e.target.value.toUpperCase())}
                  placeholder="TC-01"
                  aria-invalid={!prefixOk}
                />
                {!prefixOk && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">Format: TC-01</p>}
              </div>
              <div>
                <label className={labelCls}>Target cases</label>
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  max={120}
                  value={form.target_case_count ?? ""}
                  onChange={(e) => set("target_case_count", e.target.value ? Number(e.target.value) : null)}
                  placeholder="auto"
                />
              </div>
              <div>
                <label className={labelCls}>Default priority</label>
                <select className={inputCls} value={form.default_priority} onChange={(e) => set("default_priority", e.target.value as GenerateRequest["default_priority"])}>
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Default type</label>
                <select className={inputCls} value={form.default_type} onChange={(e) => set("default_type", e.target.value as GenerateRequest["default_type"])}>
                  {TEST_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-sky-600" checked={form.include_rtm} onChange={(e) => set("include_rtm", e.target.checked)} /> Include RTM sheet
              </label>
            </div>
          )}

          <div className="mt-auto pt-2">
            {busy ? (
              <div className="flex gap-2">
                <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent-soft text-sm font-semibold text-accent-strong dark:text-accent">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating… {elapsed}s
                </div>
                <Button size="lg" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="lg" variant="primary" icon="sparkle" className="w-full" onClick={onGenerate} disabled={!!blocker} title={blocker ?? undefined}>
                Generate test script
              </Button>
            )}
            <p className="mt-2 text-center text-[11px] text-muted">{blocker ?? "One Claude call, schema-constrained. 20 to 90 seconds."}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
