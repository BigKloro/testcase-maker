import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Undo / redo over one value. Edits that share a coalesce key within 800ms
// (typing into the same cell) collapse into a single undo step.
// ---------------------------------------------------------------------------
const LIMIT = 50;

export function useHistory<T>(initial: T) {
  const [h, setH] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const last = useRef<{ key?: string; at: number }>({ at: 0 });

  const set = useCallback((next: T, coalesceKey?: string) => {
    const now = Date.now();
    const coalesce = coalesceKey !== undefined && coalesceKey === last.current.key && now - last.current.at < 800;
    last.current = { key: coalesceKey, at: now };
    setH((s) => (Object.is(next, s.present) ? s : { past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT), present: next, future: [] }));
  }, []);

  const undo = useCallback(() => {
    last.current = { at: 0 };
    setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    last.current = { at: 0 };
    setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  /** Replace the value and forget history (new generation, new script). */
  const reset = useCallback((value: T) => {
    last.current = { at: 0 };
    setH({ past: [], present: value, future: [] });
  }, []);

  return { value: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}

// ---------------------------------------------------------------------------
// Theme: light / dark / system, stored per browser. index.html applies it before paint.
// ---------------------------------------------------------------------------
export type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "testcase-maker:theme";

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
    } catch {
      /* storage blocked */
    }
    return "system";
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {
      /* storage blocked */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => (document.documentElement.dataset.theme = pref === "system" ? (mq.matches ? "dark" : "light") : pref);
    apply();
    if (pref !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);

  return [pref, setPref] as const;
}

/** Seconds since `active` last became true. */
export function useElapsed(active: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) return;
    setS(0);
    const t = setInterval(() => setS((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  return s;
}
