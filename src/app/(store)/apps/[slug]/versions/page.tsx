import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppBySlug, links } from "@/lib/queries";
import { isAdmin } from "@/lib/auth";
import { refreshIfStale } from "@/lib/sync";
import { AppIcon } from "@/components/store/AppIcon";
import { Markdown } from "@/components/store/Markdown";
import { formatBytes, formatCount, formatDate } from "@/components/store/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getAppBySlug(slug, { admin: await isAdmin() });
  return { title: app ? `Version History · ${app.name}` : "Not found" };
}

export default async function VersionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getAppBySlug(slug, { admin: await isAdmin() });
  if (!app) notFound();
  refreshIfStale(app.raw);
  const rels = app.releases;

  return (
    <div className="pb-6 pt-5 md:pt-10">
      <Link href={links.app(app.slug)} className="animate-fade inline-flex min-h-11 items-center gap-1 text-subhead font-medium text-tint">
        <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 2L2 8l6 6" /></svg>
        {app.name}
      </Link>
      <header className="animate-rise mt-2 flex items-center gap-4">
        <AppIcon name={app.name} iconUrl={app.iconUrl} accentColor={app.accentColor} size={56} />
        <div className="min-w-0">
          <h1 className="text-title-1 text-label">Version History</h1>
          <p className="truncate text-subhead text-label-2">{app.name}</p>
        </div>
      </header>

      {rels.length === 0 ? (
        <p className="animate-rise py-20 text-center text-body text-label-2">No versions yet.</p>
      ) : (
        <ol className="mt-8 space-y-4">
          {rels.map((r, i) => {
            const isLatest = r.id === app.latest?.id;
            return (
              <li key={r.id} className="animate-rise rounded-[18px] bg-secondary p-5" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h2 className="text-title-3 text-label">{r.tag}</h2>
                  {isLatest && <span className="rounded-full bg-tint px-2 py-0.5 text-caption font-semibold text-white">Latest</span>}
                  {r.prerelease && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-caption font-semibold text-label">Pre-release</span>}
                </div>
                <p className="mt-0.5 text-footnote text-label-2">
                  {r.name && r.name !== r.tag ? `${r.name} · ` : ""}
                  <time dateTime={r.publishedAt.toISOString()}>{formatDate(r.publishedAt)}</time> · {formatCount(r.downloads)} {r.downloads === 1 ? "download" : "downloads"}
                </p>

                {r.body.trim() && (
                  <details className="group mt-3">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-subhead font-medium text-tint [&::-webkit-details-marker]:hidden">
                      <svg className="transition-transform duration-300 group-open:rotate-90" width="8" height="12" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 1l6 6-6 6" /></svg>
                      Release notes
                    </summary>
                    <div className="pb-2 pt-1"><Markdown>{r.body}</Markdown></div>
                  </details>
                )}

                {r.assets.length > 0 && (
                  <ul className="mt-3 overflow-hidden rounded-xl bg-bg">
                    {r.assets.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 [&+li]:shadow-[inset_0_0.5px_0_var(--separator)]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-subhead font-medium text-label">{a.name}</p>
                          <p className="text-caption text-label-2">
                            {formatBytes(a.size)}
                            {a.isPrimary && <span className="ml-2 font-semibold text-tint">Recommended</span>}
                          </p>
                        </div>
                        <a href={links.asset(app.slug, a.id)} className="btn-get" aria-label={`Download ${a.name}`}>
                          DOWNLOAD
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
