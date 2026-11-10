"use client";

import { useRef } from "react";

export function Shelf({ title, children, label }: { title?: string; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <section aria-label={label ?? title} className="min-w-0">
      <div className="mb-3 flex items-end justify-between">
        {title ? <h2 className="text-title-2 text-label">{title}</h2> : <span />}
        <div className="hidden gap-1.5 md:flex">
          {([-1, 1] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => scroll(d)}
              aria-label={d < 0 ? "Scroll left" : "Scroll right"}
              className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-fill text-label-2 hover:bg-fill-strong"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-1 md:gap-5"
      >
        {children}
      </div>
    </section>
  );
}
