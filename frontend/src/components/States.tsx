import { useState } from "react";
import { Card, cx, Icon, IconButton, type IconName } from "../ui";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "file", title: "Paste a requirement", body: "A Jira description or AC list, or load a sample above." },
  { icon: "sparkle", title: "Generate a first draft", body: "Grouped cases, positive first, each tied to one acceptance criterion." },
  { icon: "download", title: "Review and export", body: "Edit inline, check coverage, then download the 4-sheet workbook." },
];

export function EmptyState() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <Card key={s.title} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:text-accent">
              <Icon name={s.icon} className="size-3.5" />
            </span>
            <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
          </div>
          <h3 className="text-sm font-semibold">{s.title}</h3>
          <p className="mt-1 text-sm text-muted">{s.body}</p>
        </Card>
      ))}
    </div>
  );
}

const PHASES = ["Extracting acceptance criteria", "Grouping flows", "Writing test cases", "Validating against the style rules"];

export function GeneratingState({ elapsed }: { elapsed: number }) {
  const phase = PHASES[Math.min(PHASES.length - 1, Math.floor(elapsed / 12))];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm font-medium">{phase}…</span>
        <span className="ml-auto font-mono text-xs text-muted">{elapsed}s</span>
      </div>
      <div className="h-1 bg-subtle">
        {/* Eased toward 95% over ~90s; the real call has no progress signal yet. */}
        <div className="h-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(95, 100 * (1 - Math.exp(-elapsed / 35)))}%` }} />
      </div>
      <div className="space-y-px p-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={cx("flex animate-pulse gap-3 rounded-md px-2 py-3", i === 0 && "bg-amber-50/70 dark:bg-amber-950/20")}>
            <div className="h-3 w-16 rounded bg-subtle" />
            <div className="h-3 flex-1 rounded bg-subtle" style={{ maxWidth: `${30 + ((i * 37) % 40)}%` }} />
            <div className="hidden h-3 w-24 rounded bg-subtle sm:block" />
            <div className="hidden h-3 flex-1 rounded bg-subtle md:block" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Errors from api.ts arrive as "code: message\ndetail\ndetail". */
export function ErrorAlert({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const [head, ...details] = error.split("\n");
  const m = /^([a-z_0-9]+): (.*)$/.exec(head);
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">
      <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-400" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{m ? m[2] : head}</p>
        {m && <p className="font-mono text-xs opacity-70">{m[1]}</p>}
        {details.length > 0 && (
          <>
            <button type="button" className="mt-1 text-xs font-medium underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide" : "Show"} {details.length} detail{details.length > 1 ? "s" : ""}
            </button>
            {open && (
              <ul className="mt-2 max-h-60 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                {details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <IconButton icon="x" label="Dismiss" className="text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40" onClick={onDismiss} />
    </div>
  );
}

export function WarningList({ title, items, defaultOpen = false }: { title: string; items: string[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium" onClick={() => setOpen((o) => !o)}>
        <Icon name="alert" className="size-4 text-amber-600 dark:text-amber-400" />
        {items.length} {title}
        <Icon name={open ? "chevronUp" : "chevronDown"} className="ml-auto size-4" />
      </button>
      {open && (
        <ul className="list-disc space-y-0.5 px-4 pb-3 pl-10 text-xs">
          {items.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
