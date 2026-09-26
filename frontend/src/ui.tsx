// Shared UI primitives. Plain Tailwind on the semantic tokens in index.css, no component library.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Icons (24px grid, stroke style)
// ---------------------------------------------------------------------------
const PATHS = {
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  plus: "M12 5v14M5 12h14",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M18 13l-6 6-6-6",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  x: "M6 6l12 12M18 6L6 18",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M18 15l-6-6-6 6",
  download: "M12 4v12M6 10l6 6 6-6M4 20h16",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  check: "M5 12l5 5L20 7",
  rows: "M4 6h16M4 12h16M4 18h16",
  compress: "M4 9h16M4 15h16",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong shadow-sm",
  secondary: "border border-line bg-surface hover:bg-subtle",
  ghost: "hover:bg-subtle",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};
const SIZES = { sm: "h-7 px-2 text-xs gap-1", md: "h-9 px-3 text-sm gap-1.5", lg: "h-11 px-4 text-sm gap-2" };

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; icon?: IconName }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} className={size === "sm" ? "size-3.5" : "size-4"} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layout bits
// ---------------------------------------------------------------------------
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cx("rounded-xl border border-line bg-surface shadow-sm", className)}>{children}</div>
);

type Tone = "neutral" | "accent" | "emerald" | "rose" | "amber";
const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-muted",
  accent: "bg-accent-soft text-accent-strong dark:text-accent",
  emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  rose: "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
};
export const Badge = ({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) => (
  <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>{children}</span>
);

export const inputCls =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm shadow-xs placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";
export const labelCls = "mb-1 block text-xs font-medium text-muted";

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            value === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={title} className="toast-in w-full max-w-lg rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popover menu (position: fixed so the scrolling table can't clip it)
// ---------------------------------------------------------------------------
export interface MenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Menu({ items, label = "More actions" }: { items: MenuItem[]; label?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btn.current!.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 0;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    return { top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - h), left: Math.max(8, r.right - 184) };
  };
  const open = pos !== null;

  // Once the panel has a height, flip it above the button if it would run off the bottom.
  useLayoutEffect(() => {
    if (open) setPos(place());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (panel.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    // Follow the button while the page or table scrolls; close once it leaves the viewport.
    const follow = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) setPos(null);
      else setPos(place());
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => setPos(open ? null : place());

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={!!pos}
        onClick={toggle}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
      >
        <Icon name="more" />
      </button>
      {pos && (
        <div ref={panel} role="menu" style={pos} className="toast-in fixed z-40 w-46 rounded-lg border border-line bg-surface p-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setPos(null);
                it.onSelect();
              }}
              className={cx(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40",
                it.danger ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50" : "hover:bg-subtle",
              )}
            >
              <Icon name={it.icon} className="size-4 opacity-80" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
  action?: { label: string; onClick: () => void };
}
type ToastFn = (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback<ToastFn>(
    (message, opts = {}) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, message, tone: opts.tone ?? "info", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.action ? 7000 : 3500);
    },
    [dismiss],
  );
  const icon = { info: "check", success: "check", error: "alert" } as const;
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
            <Icon name={icon[t.tone]} className={cx("size-4 shrink-0", t.tone === "error" ? "text-rose-400 dark:text-rose-600" : "text-emerald-400 dark:text-emerald-600")} />
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="ml-1 font-semibold text-sky-300 hover:underline dark:text-sky-700"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
