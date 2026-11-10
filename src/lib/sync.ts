import "server-only";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { after } from "next/server";
import { db, dbReady } from "@/db";
import { apps, assets, releases, type App } from "@/db/schema";
import { env } from "./env";
import { getRepo, listReleases, GitHubError } from "./github";
import { selectApks } from "./apk";

const inflight = new Map<number, Promise<SyncResult>>();
export type SyncResult = { ok: true; releases: number } | { ok: false; error: string };

/** Pull releases from GitHub and mirror the APK-bearing ones into the DB. Deduplicated per app. */
export function syncApp(appId: number): Promise<SyncResult> {
  const existing = inflight.get(appId);
  if (existing) return existing;
  const p = doSync(appId).finally(() => inflight.delete(appId));
  inflight.set(appId, p);
  return p;
}

async function doSync(appId: number): Promise<SyncResult> {
  await dbReady();
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app) return { ok: false, error: "App not found" };
  if (!app.repoOwner || !app.repoName) return { ok: true, releases: 0 };

  try {
    const [repo, ghReleases] = await Promise.all([
      getRepo(app.repoOwner, app.repoName),
      listReleases(app.repoOwner, app.repoName),
    ]);

    const rows = ghReleases
      .filter((r) => app.includePrereleases || !r.prerelease)
      .map((r) => ({ r, apks: selectApks(r.assets.filter((a) => a.state === "uploaded"), app.assetPattern) }))
      // Android apps only list releases that actually ship an APK; web apps keep all (changelog).
      .filter(({ apks }) => app.kind === "web" || apks.length > 0);

    const keepIds = rows.map(({ r }) => r.id);

    await db.transaction(async (tx) => {
      for (const { r, apks } of rows) {
        const values = {
          id: r.id,
          appId: app.id,
          tag: r.tag_name.slice(0, 200),
          name: (r.name ?? "").slice(0, 300),
          body: (r.body ?? "").slice(0, 50_000),
          prerelease: r.prerelease,
          publishedAt: new Date(r.published_at ?? r.created_at),
          htmlUrl: r.html_url,
        };
        await tx.insert(releases).values(values).onConflictDoUpdate({ target: releases.id, set: values });

        const assetIds = apks.map((a) => a.id);
        if (assetIds.length) {
          await tx.delete(assets).where(and(eq(assets.releaseId, r.id), notInArray(assets.id, assetIds)));
        } else {
          await tx.delete(assets).where(eq(assets.releaseId, r.id));
        }
        for (const [i, a] of apks.entries()) {
          const av = {
            id: a.id,
            releaseId: r.id,
            appId: app.id,
            name: a.name.slice(0, 300),
            size: a.size,
            digest: a.digest ?? null,
            browserDownloadUrl: a.browser_download_url,
            isPrimary: i === 0,
          };
          await tx.insert(assets).values(av).onConflictDoUpdate({ target: assets.id, set: av });
        }
      }
      // Remove releases deleted on GitHub (or filtered out by settings).
      const stale = keepIds.length
        ? await tx.select({ id: releases.id }).from(releases).where(and(eq(releases.appId, app.id), notInArray(releases.id, keepIds)))
        : await tx.select({ id: releases.id }).from(releases).where(eq(releases.appId, app.id));
      if (stale.length) {
        const ids = stale.map((s) => s.id);
        await tx.delete(assets).where(inArray(assets.releaseId, ids));
        await tx.delete(releases).where(inArray(releases.id, ids));
      }
      await tx
        .update(apps)
        .set({ repoPrivate: repo.private, lastSyncedAt: new Date(), syncError: null })
        .where(eq(apps.id, app.id));
    });
    return { ok: true, releases: rows.length };
  } catch (e) {
    const error = e instanceof GitHubError ? e.message : "Sync failed";
    if (!(e instanceof GitHubError)) console.error("[sync]", app.slug, e);
    await db.update(apps).set({ syncError: error, lastSyncedAt: new Date() }).where(eq(apps.id, app.id));
    return { ok: false, error };
  }
}

export function isStale(app: Pick<App, "lastSyncedAt">) {
  if (!app.lastSyncedAt) return true;
  return Date.now() - app.lastSyncedAt.getTime() > env.syncTtlMinutes * 60_000;
}

/** Stale-while-revalidate: serve cached data, refresh after the response is sent. */
export function refreshIfStale(app: Pick<App, "id" | "lastSyncedAt" | "repoOwner">) {
  if (!app.repoOwner || !isStale(app)) return;
  after(() => syncApp(app.id).then(() => undefined));
}
