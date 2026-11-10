import Link from "next/link";
import { listPublicApps, type AppCard } from "@/lib/queries";
import { AppCardLarge } from "@/components/store/AppCardLarge";
import { AppRow } from "@/components/store/AppRow";
import { AppTile } from "@/components/store/AppTile";
import { Shelf } from "@/components/store/Shelf";

export const dynamic = "force-dynamic";

function Tiles({ apps }: { apps: AppCard[] }) {
  return <>{apps.map((a) => <AppTile key={a.id} app={a} />)}</>;
}

export default async function HomePage() {
  const apps = await listPublicApps();
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const featured = apps.filter((a) => a.featured);
  const recent = apps
    .filter((a) => a.latestDate)
    .sort((a, b) => b.latestDate!.getTime() - a.latestDate!.getTime())
    .slice(0, 12);
  const byCat = new Map<string, AppCard[]>();
  for (const a of apps) byCat.set(a.category, [...(byCat.get(a.category) ?? []), a]);
  const cats = [...byCat.entries()].filter(([, v]) => v.length >= 2);
  const web = apps.filter((a) => a.kind === "web");

  return (
    <div className="pb-4">
      <header className="animate-rise pb-5 pt-7 md:pt-12">
        <p className="text-eyebrow text-label-3">{date}</p>
        <h1 className="mt-1 text-large-title text-label md:text-[2.75rem]">Today</h1>
        <Link
          href="/search"
          className="pressable mt-5 flex h-11 items-center gap-2.5 rounded-[12px] bg-fill px-3.5 text-callout text-label-3 md:max-w-md"
          aria-label="Search apps"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
          </svg>
          Search apps
        </Link>
      </header>

      {apps.length === 0 ? (
        <section className="animate-rise flex flex-col items-center py-24 text-center" style={{ animationDelay: "120ms" }}>
          <div className="squircle flex h-28 w-28 items-center justify-center bg-gradient-to-br from-[#5ac8fa] via-[#0a84ff] to-[#5e5ce6] text-white shadow-float">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4v10M7.5 10l4.5 4.5 4.5-4.5M6 19h12" />
            </svg>
          </div>
          <h2 className="mt-8 text-title-1 text-label">Nothing here yet</h2>
          <p className="mt-2 max-w-[32ch] text-body text-label-2">New apps will appear here as soon as they&apos;re published. Check back soon.</p>
        </section>
      ) : (
        <div className="space-y-10">
          {featured.length > 0 && (
            <Shelf label="Featured apps">
              {featured.map((a, i) => (
                <AppCardLarge key={a.id} app={a} index={i} className={`snap-start ${featured.length === 1 ? "w-full" : "w-[88%] shrink-0 sm:w-[28rem]"}`} />
              ))}
            </Shelf>
          )}
          {recent.length > 0 && <Shelf title="New & Updated"><Tiles apps={recent} /></Shelf>}
          {cats.map(([c, list]) => (
            <Shelf key={c} title={c}><Tiles apps={list} /></Shelf>
          ))}
          {web.length > 0 && <Shelf title="Web Apps"><Tiles apps={web} /></Shelf>}

          <section aria-label="All apps">
            <h2 className="text-title-2 text-label">All Apps</h2>
            <ul className="mt-1 grid gap-x-12 md:grid-cols-2">
              {apps.map((a, i) => <AppRow key={a.id} app={a} index={i} />)}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
