import "server-only";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { apps, assets, downloads, releases, screenshots, media, type App } from "@/db/schema";
import { mediaUrl } from "./media";

export type AssetView = { id: number; name: string; size: number; digest: string | null; isPrimary: boolean };
export type ReleaseView = {
  id: number;
  tag: string;
  name: string;
  body: string;
  prerelease: boolean;
  publishedAt: Date;
  htmlUrl: string;
  downloads: number;
  assets: AssetView[];
};
export type AppCard = {
  id: number;
  slug: string;
  name: string;
  kind: "android" | "web";
  webUrl: string;
  tagline: string;
  category: string;
  developer: string;
  iconUrl: string | null;
  accentColor: string;
  featured: boolean;
  visibility: App["visibility"];
  latestVersion: string | null;
  latestSize: number | null;
  latestDate: Date | null;
  downloads: number;
};
export type AppDetail = AppCard & {
  description: string;
  packageName: string;
  repoOwner: string;
  repoName: string;
  repoPrivate: boolean;
  screenshots: { url: string; width: number | null; height: number | null }[];
  latest: ReleaseView | null;
  releases: ReleaseView[];
  lastSyncedAt: Date | null;
  syncError: string | null;
  raw: App;
};

/** Stable public URLs used by the UI. */
export const links = {
  app: (slug: string) => `/apps/${slug}`,
  versions: (slug: string) => `/apps/${slug}/versions`,
  /** Latest primary APK — or opens the web app for kind=web. */
  get: (slug: string) => `/d/${slug}`,
  asset: (slug: string, assetId: number) => `/d/${slug}/${assetId}`,
};

async function downloadCounts(appIds: number[]): Promise<Map<number, number>> {
  if (!appIds.length) return new Map();
  const rows = await db
    .select({ appId: downloads.appId, n: sql<number>`count(*)` })
    .from(downloads)
    .where(inArray(downloads.appId, appIds))
    .groupBy(downloads.appId);
  return new Map(rows.map((r) => [r.appId, Number(r.n)]));
}

async function latestPerApp(appIds: number[]) {
  const map = new Map<number, { tag: string; publishedAt: Date; size: number | null }>();
  if (!appIds.length) return map;
  const rows = await db
    .select({ appId: releases.appId, tag: releases.tag, publishedAt: releases.publishedAt, prerelease: releases.prerelease, size: assets.size })
    .from(releases)
    .innerJoin(apps, eq(apps.id, releases.appId))
    .leftJoin(assets, and(eq(assets.releaseId, releases.id), eq(assets.isPrimary, true)))
    .where(and(inArray(releases.appId, appIds), or(eq(releases.prerelease, false), eq(apps.includePrereleases, true))))
    .orderBy(desc(releases.publishedAt));
  for (const r of rows) if (!map.has(r.appId)) map.set(r.appId, { tag: r.tag, publishedAt: r.publishedAt, size: r.size });
  return map;
}

function toCard(a: App, latest: { tag: string; publishedAt: Date; size: number | null } | undefined, dl: number): AppCard {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    kind: a.kind,
    webUrl: a.webUrl,
    tagline: a.tagline,
    category: a.category,
    developer: a.developer,
    iconUrl: mediaUrl(a.iconMediaId),
    accentColor: a.accentColor,
    featured: a.featured,
    visibility: a.visibility,
    latestVersion: latest?.tag ?? null,
    latestSize: latest?.size ?? null,
    latestDate: latest?.publishedAt ?? null,
    downloads: dl,
  };
}

/** Apps shown in the public store. Android apps without any APK release are hidden (nothing to download). */
export async function listPublicApps(): Promise<AppCard[]> {
  return listApps({ publicOnly: true });
}

/** Every app, for admin. */
export async function listAllApps(): Promise<AppCard[]> {
  return listApps({ publicOnly: false });
}

async function listApps({ publicOnly }: { publicOnly: boolean }): Promise<AppCard[]> {
  await dbReady();
  const rows = await db
    .select()
    .from(apps)
    .where(publicOnly ? eq(apps.visibility, "public") : undefined)
    .orderBy(asc(apps.sortOrder), desc(apps.updatedAt));
  const ids = rows.map((r) => r.id);
  const [latest, dl] = await Promise.all([latestPerApp(ids), downloadCounts(ids)]);
  return rows
    .map((a) => toCard(a, latest.get(a.id), dl.get(a.id) ?? 0))
    .filter((c) => !publicOnly || c.kind === "web" || c.latestVersion);
}

export async function searchPublicApps(q: string): Promise<AppCard[]> {
  const needle = q.trim().toLowerCase();
  const all = await listPublicApps();
  if (!needle) return all;
  return all.filter((a) => [a.name, a.tagline, a.category, a.developer].some((s) => s.toLowerCase().includes(needle)));
}

async function loadReleases(appId: number, limit?: number, withPrereleases = true): Promise<ReleaseView[]> {
  const rels = await db
    .select()
    .from(releases)
    .where(withPrereleases ? eq(releases.appId, appId) : and(eq(releases.appId, appId), eq(releases.prerelease, false)))
    .orderBy(desc(releases.publishedAt))
    .limit(limit ?? 1000);
  if (!rels.length) return [];
  const ids = rels.map((r) => r.id);
  const [as, dls] = await Promise.all([
    db.select().from(assets).where(inArray(assets.releaseId, ids)).orderBy(desc(assets.isPrimary), asc(assets.name)),
    db
      .select({ releaseId: downloads.releaseId, n: sql<number>`count(*)` })
      .from(downloads)
      .where(inArray(downloads.releaseId, ids))
      .groupBy(downloads.releaseId),
  ]);
  const dlMap = new Map(dls.map((d) => [d.releaseId, Number(d.n)]));
  return rels.map((r) => ({
    id: r.id,
    tag: r.tag,
    name: r.name,
    body: r.body,
    prerelease: r.prerelease,
    publishedAt: r.publishedAt,
    htmlUrl: r.htmlUrl,
    downloads: dlMap.get(r.id) ?? 0,
    assets: as
      .filter((a) => a.releaseId === r.id)
      .map((a) => ({ id: a.id, name: a.name, size: a.size, digest: a.digest, isPrimary: a.isPrimary })),
  }));
}

/**
 * Public detail lookup: public + unlisted apps are reachable; drafts only for admins.
 * Pass { admin: true } only after verifying the session.
 */
export async function getAppBySlug(
  slug: string,
  opts: { admin?: boolean; beta?: boolean; releaseLimit?: number } = {},
): Promise<AppDetail | null> {
  await dbReady();
  const a = await db.query.apps.findFirst({ where: eq(apps.slug, slug) });
  if (!a) return null;
  if (a.visibility === "draft" && !opts.admin) return null;
  // Prereleases: visible to beta testers / admins, or to everyone if the app opts in.
  return buildDetail(a, opts.releaseLimit, !!(opts.admin || opts.beta || a.includePrereleases));
}

export async function getAppById(id: number): Promise<AppDetail | null> {
  await dbReady();
  const a = await db.query.apps.findFirst({ where: eq(apps.id, id) });
  return a ? buildDetail(a) : null;
}

async function buildDetail(a: App, releaseLimit?: number, withPrereleases = true): Promise<AppDetail> {
  const [rels, shots, dl] = await Promise.all([
    loadReleases(a.id, releaseLimit, withPrereleases),
    db
      .select({ mediaId: screenshots.mediaId, width: media.width, height: media.height })
      .from(screenshots)
      .innerJoin(media, eq(media.id, screenshots.mediaId))
      .where(eq(screenshots.appId, a.id))
      .orderBy(asc(screenshots.position), asc(screenshots.id)),
    downloadCounts([a.id]),
  ]);
  const latest = rels.find((r) => r.assets.length > 0) ?? rels[0] ?? null;
  return {
    ...toCard(a, latest ? { tag: latest.tag, publishedAt: latest.publishedAt, size: latest.assets[0]?.size ?? null } : undefined, dl.get(a.id) ?? 0),
    description: a.description,
    packageName: a.packageName,
    repoOwner: a.repoOwner,
    repoName: a.repoName,
    repoPrivate: a.repoPrivate,
    screenshots: shots.map((s) => ({ url: `/media/${s.mediaId}`, width: s.width, height: s.height })),
    latest,
    releases: rels,
    lastSyncedAt: a.lastSyncedAt,
    syncError: a.syncError,
    raw: a,
  };
}

export async function recordDownload(appId: number, releaseId: number | null, assetId: number | null) {
  await db.insert(downloads).values({ appId, releaseId, assetId });
}

/** Daily download counts for the last `days` days (oldest first), optionally for one app. */
export async function downloadSeries(days = 30, appId?: number): Promise<{ day: string; count: number }[]> {
  await dbReady();
  const since = new Date(Date.now() - days * 86_400_000);
  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${downloads.createdAt}, 'unixepoch')`;
  const rows = await db
    .select({ day: dayExpr, n: sql<number>`count(*)` })
    .from(downloads)
    .where(and(gte(downloads.createdAt, since), appId ? eq(downloads.appId, appId) : undefined))
    .groupBy(dayExpr);
  const map = new Map(rows.map((r) => [r.day, Number(r.n)]));
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day: d, count: map.get(d) ?? 0 });
  }
  return out;
}

export const CATEGORIES = [
  "Productivity", "Utilities", "Tools", "Social", "Entertainment", "Games", "Education",
  "Health & Fitness", "Finance", "Music & Audio", "Photography", "Lifestyle", "Travel", "Developer Tools",
] as const;
