import type { ThemePref } from "../hooks";
import type { Health } from "../types";
import { Badge, Button, cx, Icon, type IconName } from "../ui";

const THEMES: { id: ThemePref; icon: IconName; label: string }[] = [
  { id: "light", icon: "sun", label: "Light" },
  { id: "dark", icon: "moon", label: "Dark" },
  { id: "system", icon: "monitor", label: "System" },
];

export function TopBar({ health, theme, onTheme, onNew, canReset }: { health: Health | null; theme: ThemePref; onTheme: (t: ThemePref) => void; onNew: () => void; canReset: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-on-accent">
          <Icon name="file" className="size-4.5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] leading-tight font-semibold tracking-tight whitespace-nowrap">TestCase Maker</h1>
          <p className="hidden text-xs text-muted sm:block">SIT/UAT scripts from a requirement. First draft in a minute, you review.</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:block">
            <Badge tone="amber">
              <Icon name="alert" className="size-3.5" /> Public demo · no real client data
            </Badge>
          </span>
          {health?.mock && (
            <span className="hidden sm:block">
              <Badge tone="accent">Mock mode</Badge>
            </span>
          )}
          {health && (
            <span className="hidden items-center gap-1.5 text-xs text-muted lg:flex" title={health.jira ? "Jira credentials configured on the server" : "Jira is not configured on this server"}>
              <span className={cx("size-2 rounded-full", health.jira ? "bg-emerald-500" : "bg-slate-400")} />
              Jira
            </span>
          )}
          <div role="radiogroup" aria-label="Theme" className="flex rounded-md border border-line p-0.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                title={`${t.label} theme`}
                onClick={() => onTheme(t.id)}
                className={cx("flex size-7 items-center justify-center rounded", theme === t.id ? "bg-subtle text-fg" : "text-muted hover:text-fg")}
              >
                <Icon name={t.icon} className="size-3.5" />
              </button>
            ))}
          </div>
          {canReset && (
            <Button size="sm" icon="plus" onClick={onNew}>
              <span className="hidden sm:inline">New script</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
