"use client";

import { Fragment, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";

export type SearchItem = { key: number; haystack: string; category: string; row: ReactNode };

/** Filters server-rendered rows as you type; keeps ?q=&category= in the URL (shareable, back-button safe). */
export function LiveSearch({
  items,
  categories,
  initialQ,
  initialCategory,
}: {
  items: SearchItem[];
  categories: string[];
  initialQ: string;
  initialCategory: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const deferredQ = useDeferredValue(q);

  const results = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    return items.filter((it) => (!category || it.category === category) && (!needle || it.haystack.includes(needle)));
  }, [items, deferredQ, category]);

  // Mirror state into the URL without a navigation (no server round-trip).
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim().slice(0, 100));
      if (category) p.set("category", category);
      const next = `/search${p.size ? `?${p}` : ""}`;
      if (next !== location.pathname + location.search) history.replaceState(history.state, "", next);
    }, 250);
    return () => clearTimeout(t);
  }, [q, category]);

  const trimmed = deferredQ.trim();

  return (
    <>
      <form
        action="/search"
        method="get"
        role="search"
        className="animate-rise mt-4"
        style={{ animationDelay: "60ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // dismiss the phone keyboard
        }}
      >
        {category && <input type="hidden" name="category" value={category} />}
        <div className="relative md:max-w-md">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-label-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
          </svg>
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            autoComplete="off"
            maxLength={100}
            placeholder="Apps, categories, developers"
            aria-label="Search apps"
            enterKeyHint="search"
            className="field !pl-10"
          />
        </div>
      </form>

      {categories.length > 0 && (
        <nav aria-label="Categories" className="no-scrollbar animate-rise -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1" style={{ animationDelay: "120ms" }}>
          {["", ...categories].map((c) => {
            const on = c === category;
            return (
              <button
                key={c || "all"}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={on}
                className={`pressable inline-flex h-9 shrink-0 items-center rounded-full px-4 text-subhead font-medium ${on ? "bg-label text-bg" : "bg-fill text-label"}`}
              >
                {c || "All"}
              </button>
            );
          })}
        </nav>
      )}

      <section aria-live="polite" className="mt-6">
        {results.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="text-title-3 text-label">No results</h2>
            <p className="mt-1 text-subhead text-label-2">{trimmed ? <>Nothing matched &ldquo;{trimmed}&rdquo;.</> : "No apps in this category yet."}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-12 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {results.map((it) => <Fragment key={it.key}>{it.row}</Fragment>)}
          </ul>
        )}
      </section>
    </>
  );
}

