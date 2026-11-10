import Link from "next/link";
import { listPublicApps, searchPublicApps } from "@/lib/queries";
import { AppRow } from "@/components/store/AppRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const category = (sp.category ?? "").trim();
  const [all, found] = await Promise.all([listPublicApps(), searchPublicApps(q)]);
  const categories = [...new Set(all.map((a) => a.category))].sort();
  const results = category ? found.filter((a) => a.category === category) : found;
  const href = (c: string) => `/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(c ? { category: c } : {}) }).toString()}`;

  return (
    <div className="pt-7 md:pt-12">
      <h1 className="animate-rise text-large-title text-label">Search</h1>
      <form action="/search" method="get" role="search" className="animate-rise mt-4" style={{ animationDelay: "60ms" }}>
        {category && <input type="hidden" name="category" value={category} />}
        <div className="relative md:max-w-md">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-label-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            autoComplete="off"
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
              <Link
                key={c || "all"}
                href={href(c)}
                aria-current={on ? "true" : undefined}
                className={`pressable inline-flex h-9 shrink-0 items-center rounded-full px-4 text-subhead font-medium ${on ? "bg-label text-bg" : "bg-fill text-label"}`}
              >
                {c || "All"}
              </Link>
            );
          })}
        </nav>
      )}

      <section aria-live="polite" className="mt-6">
        {results.length === 0 ? (
          <div className="animate-rise py-20 text-center">
            <h2 className="text-title-3 text-label">No results</h2>
            <p className="mt-1 text-subhead text-label-2">{q ? <>Nothing matched &ldquo;{q}&rdquo;.</> : "No apps in this category yet."}</p>
          </div>
        ) : (
          <ul className="grid gap-x-12 md:grid-cols-2">
            {results.map((a, i) => <AppRow key={a.id} app={a} index={i} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
