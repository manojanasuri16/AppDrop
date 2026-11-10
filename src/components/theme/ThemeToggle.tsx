"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Pref = "system" | "light" | "dark";
declare global {
  interface Window { __appdropSetTheme?: (p: Pref) => void }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("appdrop-theme", cb);
  return () => window.removeEventListener("appdrop-theme", cb);
};
const getPref = (): Pref => (document.documentElement.dataset.themePref as Pref) || "system";
const getResolved = () => document.documentElement.dataset.theme || "light";

const OPTIONS: { value: Pref; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Automatic", icon: <AutoIcon /> },
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

/** Compact header control: icon button → menu with Automatic / Light / Dark. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, getPref, () => "system" as Pref);
  const resolved = useSyncExternalStore(subscribe, getResolved, () => "light");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (p: Pref) => {
    // Cross-fade colors instead of snapping (skipped automatically under reduced motion).
    const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const run = () => window.__appdropSetTheme?.(p);
    if (d.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) d.startViewTransition(run);
    else run();
    setOpen(false);
  };

  const current = pref === "system" ? <AutoIcon /> : resolved === "dark" ? <MoonIcon /> : <SunIcon />;

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${OPTIONS.find((o) => o.value === pref)?.label}`}
        className="pressable flex h-11 w-11 items-center justify-center rounded-full text-label-2 hover:bg-fill hover:text-label"
      >
        <span className="flex h-5 w-5 items-center justify-center">{current}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className="material animate-fade absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl p-1.5 shadow-float ring-1 ring-black/5 dark:ring-white/10"
        >
          <p className="text-eyebrow px-3 pb-1 pt-2 text-label-3">Appearance</p>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={pref === o.value}
              onClick={() => choose(o.value)}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-callout text-label transition-colors hover:bg-fill"
            >
              <span className="flex h-5 w-5 items-center justify-center text-label-2">{o.icon}</span>
              <span className="flex-1">{o.label}</span>
              {pref === o.value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tint)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </svg>
  );
}
