import Link from "next/link";
import { headers } from "next/headers";
import { db, dbReady } from "@/db";
import { apps } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { downloadSeries, listAllApps } from "@/lib/queries";
import { AppList, type AdminRow } from "@/components/admin/AppList";
import { ActionButton } from "@/components/admin/ActionButton";
import { BarChart } from "@/components/admin/BarChart";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { PlusIcon, RefreshIcon, GlobeIcon } from "@/components/admin/icons";
import { fmtNum, timeAgo } from "@/components/admin/format";
import { syncAll } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  await dbReady();
  const [list, series, syncRows, h] = await Promise.all([
    listAllApps(),
    downloadSeries(30),
    db.select({ id: apps.id, owner: apps.repoOwner, at: apps.lastSyncedAt, err: apps.syncError }).from(apps),
    headers(),
  ]);
  const sync = new Map(syncRows.map((r) => [r.id, r]));
  const now = Date.now();
  const rows: AdminRow[] = list.map((a) => {
    const s = sync.get(a.id);
    return {
      id: a.id, name: a.name, kind: a.kind, iconUrl: a.iconUrl, accentColor: a.accentColor,
      version: a.latestVersion, downloads: a.downloads, visibility: a.visibility, featured: a.featured,
      sync: s?.err
        ? { state: "error", label: "Sync error", error: s.err }
        : s?.owner && s.at
          ? { state: "ok", label: `Synced ${timeAgo(s.at, now)}` }
          : { state: "none", label: s?.owner ? "Not synced yet" : "No repo" },
    };
  });
  const totalDl = list.reduce((n, a) => n + a.downloads, 0);
  const last30 = series.reduce((n, d) => n + d.count, 0);
  const publicCount = list.filter((a) => a.visibility === "public").length;
  const errors = rows.filter((r) => r.sync.state === "error").length;

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const tiles = [
    { label: "Total downloads", value: fmtNum(totalDl) },
    { label: "Last 30 days", value: fmtNum(last30) },
    { label: "Public apps", value: `${publicCount}`, sub: `of ${list.length}` },
    { label: "Sync errors", value: `${errors}`, danger: errors > 0 },
  ];

  return (
    <div className="animate-rise flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-large-title">Apps</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="pressable text-subhead min-h-11 content-center rounded-full px-3 font-medium text-tint hover:bg-fill">View Store</Link>
          <SignOutButton className="sm:hidden" />
          <ActionButton action={syncAll} pendingLabel="Syncing…" icon={<RefreshIcon width={18} height={18} />}>Sync All</ActionButton>
          <Link href="/admin/apps/new" className="btn-primary"><PlusIcon width={18} height={18} strokeWidth={2.4} />Add App</Link>
        </div>
      </div>

      {!env.githubToken && (
        <div role="note" className="text-subhead rounded-2xl bg-warning/15 px-4 py-3">
          <strong className="font-semibold">GitHub token not configured</strong> — only public repos work. Set <code className="rounded bg-fill px-1">GITHUB_TOKEN</code> to connect private repositories.
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-elevated p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <dt className="text-footnote text-label-2">{t.label}</dt>
            <dd className={`text-title-1 mt-1 tabular-nums ${t.danger ? "text-danger" : ""}`}>
              {t.value}{t.sub && <span className="text-subhead ml-1.5 font-normal text-label-2">{t.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-2xl bg-elevated p-5" style={{ boxShadow: "var(--shadow-card)" }} aria-labelledby="dl-h">
        <h2 id="dl-h" className="text-headline mb-4">Downloads · last 30 days</h2>
        <BarChart data={series} label="Daily downloads across all apps" />
      </section>

      {rows.length === 0 ? (
        <div className="group-list px-6 py-14 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-fill text-tint"><PlusIcon width={30} height={30} /></div>
          <h2 className="text-title-3">Add your first app</h2>
          <p className="text-subhead mx-auto mt-1.5 max-w-sm text-label-2">Connect a GitHub repository to share an Android app from its releases, or link a deployed web app.</p>
          <Link href="/admin/apps/new" className="btn-primary mt-6">Add App</Link>
        </div>
      ) : (
        <AppList rows={rows} />
      )}

      {env.githubWebhookSecret && (
        <section className="group-list p-5" aria-labelledby="wh-h">
          <h2 id="wh-h" className="text-headline flex items-center gap-2"><GlobeIcon width={18} height={18} className="text-label-2" /> GitHub webhook</h2>
          <p className="text-subhead mt-1.5 text-label-2">New releases sync automatically. In each repo, go to Settings → Webhooks and add:</p>
          <dl className="text-subhead mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-label-2">Payload URL</dt><dd className="font-mono break-all select-all">{origin}/api/webhooks/github</dd>
            <dt className="text-label-2">Content type</dt><dd>application/json</dd>
            <dt className="text-label-2">Secret</dt><dd>Your <code className="rounded bg-fill px-1">GITHUB_WEBHOOK_SECRET</code></dd>
            <dt className="text-label-2">Events</dt><dd>Releases</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
