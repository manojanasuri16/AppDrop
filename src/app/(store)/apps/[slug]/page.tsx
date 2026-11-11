import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppBySlug, links } from "@/lib/queries";
import { isAdmin } from "@/lib/auth";
import { refreshIfStale } from "@/lib/sync";
import { AppIcon } from "@/components/store/AppIcon";
import { DownloadLine } from "@/components/store/DownloadLine";
import { GetButton } from "@/components/store/GetButton";
import { Markdown } from "@/components/store/Markdown";
import { RelativeTime } from "@/components/store/RelativeTime";
import { ScreenshotGallery } from "@/components/store/ScreenshotGallery";
import { StickyAppBar } from "@/components/store/StickyAppBar";
import { ShareButton } from "@/components/store/ShareButton";
import { NotifyButton } from "@/components/store/NotifyButton";
import { FeedbackButton } from "@/components/store/FeedbackButton";
import { withVia } from "@/components/store/share-url";
import { isBetaViewer } from "@/lib/beta";
import { trackView } from "@/lib/track";
import { getSiteOrigin, qrSvg } from "@/components/store/share-server";
import { InstallHelp } from "@/components/store/InstallHelp";
import { CopyButton } from "@/components/store/CopyButton";
import { Expandable } from "@/components/store/Expandable";
import { cleanDigest, formatBytes, formatCount, hostname } from "@/components/store/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getAppBySlug(slug, { admin: await isAdmin(), beta: await isBetaViewer() });
  if (!app) return { title: "Not found" };
  return {
    title: app.name,
    description: app.tagline,
    // openGraph.images comes from the sibling opengraph-image.tsx file convention.
    openGraph: { title: app.name, description: app.tagline },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 px-4 py-2.5">
      <dt className="shrink-0 text-body text-label">{label}</dt>
      <dd className="min-w-0 text-right text-body text-label-2">{children}</dd>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex min-w-[6.5rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 border-l-[0.5px] border-separator px-3 text-center first:border-l-0">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-label-3">{label}</p>
      <p className="text-title-3 text-label-2">{value}</p>
      {sub && <p className="text-caption text-label-3">{sub}</p>}
    </div>
  );
}

export default async function AppPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ via?: string }> }) {
  const { slug } = await params;
  const app = await getAppBySlug(slug, { admin: await isAdmin(), beta: await isBetaViewer() });
  if (!app) notFound();
  await trackView(app.id, (await searchParams).via);
  refreshIfStale(app.raw);

  const web = app.kind === "web";
  const latest = app.latest;
  const primary = latest?.assets.find((a) => a.isPrimary) ?? latest?.assets[0] ?? null;
  const unavailable = !web && !primary;
  const href = links.get(app.slug);
  const digest = cleanDigest(primary?.digest);
  const appUrl = `${await getSiteOrigin()}${links.app(app.slug)}`;
  const appQr = await qrSvg(withVia(appUrl, "qr"));
  const shareText = app.tagline ? `${app.name} — ${app.tagline}` : `Check out ${app.name} on AppDrop`;
  const updated = web ? app.raw.updatedAt : (app.latestDate ?? app.raw.updatedAt);

  return (
    <article className="pb-6">
      <StickyAppBar targetId="app-header" name={app.name} kind={app.kind} iconUrl={app.iconUrl} accentColor={app.accentColor} href={href} disabled={unavailable} shareUrl={appUrl} shareText={shareText} qrSvg={appQr} />

      {app.visibility === "draft" && (
        <p role="status" className="mt-4 rounded-xl bg-warning/15 px-4 py-2.5 text-subhead font-medium text-label">Draft — only you can see this</p>
      )}

      <header id="app-header" className="animate-rise flex gap-4 pb-6 pt-6 md:gap-7 md:pt-10">
        <AppIcon name={app.name} iconUrl={app.iconUrl} accentColor={app.accentColor} size={112} priority className="shadow-card md:!h-40 md:!w-40" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <h1 className="text-title-2 text-label md:text-large-title">{app.name}</h1>
            {app.visibility === "unlisted" && (
              <span className="mt-1 shrink-0 rounded-full bg-fill px-2 py-0.5 text-caption font-semibold text-label-2">Unlisted</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-subhead text-label-2">{app.tagline || app.developer}</p>
          {app.tagline && <p className="truncate text-footnote text-label-3">{app.developer}</p>}
          <div className="mt-auto flex items-center gap-3 pt-3">
            <GetButton app={app} href={href} size="lg" disabled={unavailable} />
            <ShareButton url={appUrl} title={app.name} text={shareText} variant="icon" label={`Share ${app.name}`} qrSvg={appQr} className="-mx-1" />
            <DownloadLine href={href} enabled={!web}>
            <p className="min-w-0 text-caption text-label-3">
              {unavailable ? "No release yet" : web ? hostname(app.webUrl) : <>{latest?.prerelease ? "Beta" : "Version"} {latest?.tag}<br />{formatBytes(primary?.size)}</>}
            </p>
            </DownloadLine>
          </div>
        </div>
      </header>

      {!web && !unavailable && <NotifyButton topic={`app:${app.slug}`} className="animate-rise -mt-2 mb-5" />}

      <div className="animate-rise no-scrollbar -mx-5 flex overflow-x-auto border-y-[0.5px] border-separator px-5 py-3.5" style={{ animationDelay: "80ms" }} role="list" aria-label="App facts">
        <Stat label={web ? "Opens" : "Downloads"} value={formatCount(app.downloads)} />
        {!web && <Stat label="Version" value={app.latestVersion ?? "—"} />}
        {!web && <Stat label="Size" value={formatBytes(primary?.size)} />}
        <Stat label="Category" value={<span className="text-body">{app.category}</span>} />
        <Stat label="Updated" value={<RelativeTime date={updated} />} />
      </div>

      {app.screenshots.length > 0 && (
        <section aria-label="Screenshots" className="animate-rise mt-8" style={{ animationDelay: "140ms" }}>
          <h2 className="sr-only">Screenshots</h2>
          <ScreenshotGallery shots={app.screenshots} name={app.name} />
        </section>
      )}

      {app.description.trim() && (
        <section className="mt-8">
          <h2 className="sr-only">About</h2>
          <Expandable long={app.description.length > 420}>
            <Markdown>{app.description}</Markdown>
          </Expandable>
        </section>
      )}

      {!web && latest && (
        <section className="mt-8 border-t-[0.5px] border-separator pt-6" aria-labelledby="whats-new">
          <div className="flex items-baseline justify-between">
            <h2 id="whats-new" className="text-title-2 text-label">What&apos;s New</h2>
            <Link href={links.versions(app.slug)} className="min-h-11 py-2.5 text-subhead font-medium text-tint">Version History</Link>
          </div>
          <p className="mt-0.5 flex gap-2 text-footnote text-label-3">
            <span>{latest.tag}</span>{latest.prerelease && <span className="rounded-full bg-warning px-2 py-px text-caption font-semibold text-white">Beta</span>}·<RelativeTime date={latest.publishedAt} />
          </p>
          <div className="mt-3">
            <Expandable long={latest.body.length > 360}>
              {latest.body.trim() ? <Markdown>{latest.body}</Markdown> : <p className="text-subhead text-label-2">Bug fixes and improvements.</p>}
            </Expandable>
          </div>
        </section>
      )}

      {!web && (
        <section className="mt-6">
          <div className="group-list" style={{ background: "var(--bg-secondary)" }}>
            <InstallHelp />
          </div>
        </section>
      )}

      <section className="mt-8" aria-labelledby="info">
        <h2 id="info" className="mb-3 text-title-2 text-label">Information</h2>
        <dl className="group-list" style={{ background: "var(--bg-secondary)" }}>
          <Row label="Developer">{app.developer || "—"}</Row>
          <Row label="Category">{app.category}</Row>
          {!web && app.packageName && <Row label="Package"><span className="break-all font-mono text-footnote">{app.packageName}</span></Row>}
          {!web && <Row label="Size">{formatBytes(primary?.size)}</Row>}
          <Row label="Compatibility">{web ? "Any modern browser" : "Android"}</Row>
          {web && <Row label="Website"><a href={app.webUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-tint">{hostname(app.webUrl)}</a></Row>}
          {!web && (
            <Row label="Source">
              {app.repoPrivate || !app.repoOwner ? (
                "Private repository"
              ) : (
                <a href={`https://github.com/${app.repoOwner}/${app.repoName}`} target="_blank" rel="noopener noreferrer" className="text-tint">GitHub</a>
              )}
            </Row>
          )}
          {!web && digest && (
            <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
              <dt className="shrink-0 text-body text-label">SHA-256</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-footnote text-label-2" title={digest}>{digest}</span>
                <CopyButton value={digest} label="Copy SHA-256" />
              </dd>
            </div>
          )}
          <ShareButton url={appUrl} title={app.name} text={shareText} variant="row" label="Share App" qrSvg={appQr} />
          <FeedbackButton slug={app.slug} appName={app.name} versions={web ? [] : app.releases.map((r) => r.tag)} />
        </dl>
      </section>
    </article>
  );
}
