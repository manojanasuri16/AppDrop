import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CATEGORIES, downloadSeries, getAppById, links } from "@/lib/queries";
import { AppForm, type AppDefaults } from "@/components/admin/AppForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { BarChart } from "@/components/admin/BarChart";
import { DeleteApp } from "@/components/admin/DeleteApp";
import { Section } from "@/components/admin/Field";
import { ScreenshotManager } from "@/components/admin/ScreenshotManager";
import { ArrowLeft, ExternalIcon, GlobeIcon, LockIcon, PhoneIcon, RefreshIcon, DownloadIcon } from "@/components/admin/icons";
import { fmtBytes, fmtDate, fmtNum, timeAgo } from "@/components/admin/format";
import { importFromRepo, syncNow, updateApp } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditAppPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: raw } = await params;
  if (!/^\d+$/.test(raw)) notFound();
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const app = await getAppById(id);
  if (!app) notFound();
  const series = await downloadSeries(30, id);
  const a = app.raw;
  const hasRepo = !!app.repoOwner;

  const defaults: AppDefaults = {
    kind: a.kind, name: a.name, slug: a.slug, tagline: a.tagline, description: a.description, category: a.category,
    developer: a.developer, accentColor: a.accentColor, packageName: a.packageName,
    repo: hasRepo ? `${app.repoOwner}/${app.repoName}` : "", webUrl: a.webUrl, assetPattern: a.assetPattern,
    includePrereleases: a.includePrereleases, visibility: a.visibility, featured: a.featured, sortOrder: a.sortOrder,
    iconUrl: app.iconUrl,
  };
  const vis = { public: "Public", unlisted: "Unlisted", draft: "Draft" }[app.visibility];
  const last30 = series.reduce((n, d) => n + d.count, 0);

  return (
    <div className="animate-rise mx-auto flex max-w-3xl flex-col gap-10">
      <div>
        <Link href="/admin" className="pressable text-subhead -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-tint"><ArrowLeft width={18} height={18} />Apps</Link>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div
            className="squircle grid size-20 shrink-0 place-items-center overflow-hidden text-title-1 text-white"
            style={{ background: app.iconUrl ? "var(--fill)" : `linear-gradient(145deg, ${app.accentColor}, color-mix(in srgb, ${app.accentColor} 60%, #000))`, boxShadow: "inset 0 0 0 0.5px var(--separator)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {app.iconUrl ? <img src={app.iconUrl} alt="" className="size-full object-cover" /> : app.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-title-1 truncate">{app.name}</h1>
            <div className="text-footnote mt-1 flex flex-wrap items-center gap-2 text-label-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 font-medium">
                {app.kind === "android" ? <PhoneIcon width={12} height={12} /> : <GlobeIcon width={12} height={12} />}
                {app.kind === "android" ? "Android" : "Web"}
              </span>
              <span className="rounded-full bg-fill px-2 py-0.5 font-medium">{vis}</span>
              {app.repoPrivate && <span className="inline-flex items-center gap-1"><LockIcon width={12} height={12} />Private repo</span>}
            </div>
          </div>
          <Link href={links.app(app.slug)} className="btn-secondary w-full sm:w-auto" target="_blank">
            View in store <ExternalIcon width={16} height={16} />
          </Link>
        </div>
      </div>

      <AppForm mode="edit" action={updateApp.bind(null, id)} defaults={defaults} categories={CATEGORIES} />

      <Section
        title="Media"
        footer={hasRepo ? "Import reads fastlane/metadata/android in the repository (title, descriptions, icon and phone screenshots). Only empty fields are filled." : "Connect a repository to import metadata from its fastlane folder."}
      >
        <div className="group-list">
          <div className="p-4">
            <h3 className="text-headline mb-3">Screenshots</h3>
            <ScreenshotManager appId={id} shots={app.screenshots.map((s) => ({ id: s.url.split("/").pop()!, url: s.url }))} />
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-callout font-medium">Import from repo</div>
              <div className="text-footnote text-label-2">Fill name, description, icon and screenshots from fastlane metadata.</div>
            </div>
            {hasRepo
              ? <ActionButton action={importFromRepo.bind(null, id)} pendingLabel="Importing…" icon={<DownloadIcon width={18} height={18} />}>Import</ActionButton>
              : <span className="text-footnote text-label-3">No repo connected</span>}
          </div>
        </div>
      </Section>

      <Section title="Releases">
        <div className="group-list">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-subhead text-label-2">
              {hasRepo ? <>Last synced <strong className="font-medium text-label">{timeAgo(app.lastSyncedAt)}</strong> from {app.repoOwner}/{app.repoName}</> : "No repository connected."}
            </div>
            {hasRepo && <ActionButton action={syncNow.bind(null, id)} pendingLabel="Syncing…" icon={<RefreshIcon width={18} height={18} />}>Sync now</ActionButton>}
          </div>
          {app.syncError && (
            <div role="alert" className="text-subhead bg-danger/10 px-4 py-3 text-danger">Sync failed: {app.syncError}</div>
          )}
          {app.releases.length === 0 && hasRepo && !app.syncError && (
            <div className="text-subhead px-4 py-8 text-center text-label-2">No releases found yet.</div>
          )}
          {app.releases.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="text-headline hover:underline">{r.tag}</a>
                {r.prerelease && <span className="text-caption rounded-full bg-warning/20 px-2 py-0.5 font-semibold">Pre-release</span>}
                <span className="text-footnote text-label-2">{fmtDate(r.publishedAt)}</span>
                <span className="text-footnote ml-auto tabular-nums text-label-2">{fmtNum(r.downloads)} downloads</span>
              </div>
              {r.assets.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {r.assets.map((s) => (
                    <li key={s.id} className="text-footnote flex items-center gap-2">
                      <span className="min-w-0 truncate font-mono">{s.name}</span>
                      {s.isPrimary && <span className="text-caption shrink-0 rounded-full bg-tint/15 px-2 py-0.5 font-semibold text-tint">Primary</span>}
                      <span className="ml-auto shrink-0 text-label-2">{fmtBytes(s.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-footnote mt-2 text-label-2">No APK assets.</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Stats">
        <div className="rounded-2xl bg-elevated p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-headline">Downloads · last 30 days</h3>
            <span className="text-footnote text-label-2">{fmtNum(app.downloads)} all time</span>
          </div>
          <BarChart data={series} label={`Daily downloads for ${app.name} (${fmtNum(last30)} total)`} />
        </div>
      </Section>

      <Section title="Danger zone">
        <DeleteApp appId={id} name={app.name} />
      </Section>
    </div>
  );
}
