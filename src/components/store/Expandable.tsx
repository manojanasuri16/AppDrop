"use client";

import { useState } from "react";

/** Clamps tall content with a fade and a "more" control. */
export function Expandable({ children, collapsedHeight = 132, long = true }: { children: React.ReactNode; collapsedHeight?: number; long?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!long) return <>{children}</>;
  return (
    <div>
      <div
        className="relative overflow-hidden transition-[max-height] duration-500 ease-[var(--ease-spring)]"
        style={{ maxHeight: open ? 4000 : collapsedHeight }}
      >
        {children}
        {!open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg to-transparent" />}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1 min-h-11 text-subhead font-semibold text-tint"
      >
        {open ? "less" : "more"}
      </button>
    </div>
  );
}
