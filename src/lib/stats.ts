import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { apps, downloads, feedback, pageViews, releases, versionPings } from "@/db/schema";
import { env } from "./env";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export type ViewSource = "direct" | "share" | "qr" | "app";
export function viewSource(via: string | string[] | undefined): ViewSource {
  const v = Array.isArray(via) ? via[0] : via;
  return v === "share" || v === "qr" || v === "app" ? v : "direct";
}

export function isBot(ua: string | null) {
  return !ua || /bot|crawler|spider|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless/i.test(ua);
}

/** Increment the aggregated page-view counter. appId 0 = store home. */
export async function recordPageView(appId: number, source: ViewSource) {
  await dbReady();
  await db
    .insert(pageViews)
    .values({ appId, day: today(), source, count: 1 })
    .onConflictDoUpdate({ target: [pageViews.appId, pageViews.day, pageViews.source], set: { count: sql`${pageViews.count} + 1` } });
}

/** One anonymous row per app/day/device from in-app update checks. The device id is hashed with a server secret. */
export async function recordVersionPing(appId: number, device: string, version: string) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(device) || !/^[\w.+-]{1,50}$/.test(version)) return;
  const hashed = createHash("sha256").update(device + "|" + env.sessionSecret).digest("hex").slice(0, 24);
  await dbReady();
  await db
    .insert(versionPings)
    .values({ appId, day: today(), device: hashed, version })
    .onConflictDoUpdate({ target: [versionPings.appId, versionPings.day, versionPings.device], set: { version } });
}

export type AppStats = {
  views: { total: number; bySource: Record<ViewSource, number>; series: { day: string; count: number }[] };
  downloads30d: number;
  conversion: number | null; // downloads / views over 30d
  downloadsByVersion: { tag: string; prerelease: boolean; count: number }[];
  activeDevices: { total: number; byVersion: { version: string; devices: number }[]; onLatest: number | null };
  feedback: { total: number; unread: number };
};

/** Per-app stats for the admin (default: last 30 days). */
export async function appStats(appId: number, days = 30, latestTag?: string | null): Promise<AppStats> {
  await dbReady();
  const since = daysAgo(days - 1);
  const sinceDate = new Date(Date.now() - days * 86_400_000);
  const [views, dl30, byVer, pings, fb] = await Promise.all([
    db.select({ day: pageViews.day, source: pageViews.source, count: pageViews.count }).from(pageViews)
      .where(and(eq(pageViews.appId, appId), gte(pageViews.day, since))),
    db.select({ n: sql<number>`count(*)` }).from(downloads).where(and(eq(downloads.appId, appId), gte(downloads.createdAt, sinceDate))),
    db.select({ tag: releases.tag, prerelease: releases.prerelease, count: sql<number>`count(${downloads.id})` })
      .from(releases).leftJoin(downloads, eq(downloads.releaseId, releases.id))
      .where(eq(releases.appId, appId)).groupBy(releases.id).orderBy(desc(releases.publishedAt)).limit(20),
    // Latest known version per device within the window.
    db.all<{ version: string; devices: number }>(sql`
      SELECT version, COUNT(*) AS devices FROM (
        SELECT device, version, ROW_NUMBER() OVER (PARTITION BY device ORDER BY day DESC) AS rn
        FROM version_pings WHERE app_id = ${appId} AND day >= ${since}
      ) WHERE rn = 1 GROUP BY version ORDER BY devices DESC`),
    db.select({ total: sql<number>`count(*)`, unread: sql<number>`sum(case when ${feedback.readAt} is null then 1 else 0 end)` })
      .from(feedback).where(eq(feedback.appId, appId)),
  ]);
  const bySource: Record<ViewSource, number> = { direct: 0, share: 0, qr: 0, app: 0 };
  const perDay = new Map<string, number>();
  for (const v of views) {
    bySource[v.source as ViewSource] = (bySource[v.source as ViewSource] ?? 0) + v.count;
    perDay.set(v.day, (perDay.get(v.day) ?? 0) + v.count);
  }
  const total = Object.values(bySource).reduce((a, b) => a + b, 0);
  const series = Array.from({ length: days }, (_, i) => {
    const day = daysAgo(days - 1 - i);
    return { day, count: perDay.get(day) ?? 0 };
  });
  const downloads30d = Number(dl30[0]?.n ?? 0);
  const deviceRows = pings.map((p) => ({ version: String(p.version), devices: Number(p.devices) }));
  const deviceTotal = deviceRows.reduce((a, b) => a + b.devices, 0);
  const norm = (s: string) => s.replace(/^[vV]/, "");
  const onLatest = latestTag && deviceTotal
    ? deviceRows.filter((r) => norm(r.version) === norm(latestTag)).reduce((a, b) => a + b.devices, 0) / deviceTotal
    : null;
  return {
    views: { total, bySource, series },
    downloads30d,
    conversion: total ? downloads30d / total : null,
    downloadsByVersion: byVer.map((r) => ({ tag: r.tag, prerelease: r.prerelease, count: Number(r.count) })),
    activeDevices: { total: deviceTotal, byVersion: deviceRows, onLatest },
    feedback: { total: Number(fb[0]?.total ?? 0), unread: Number(fb[0]?.unread ?? 0) },
  };
}

/** Store-wide numbers for the dashboard. */
export async function storeStats(days = 30) {
  await dbReady();
  const since = daysAgo(days - 1);
  const [views, unread, devices] = await Promise.all([
    db.select({ source: pageViews.source, n: sql<number>`sum(${pageViews.count})` }).from(pageViews)
      .where(gte(pageViews.day, since)).groupBy(pageViews.source),
    db.select({ n: sql<number>`count(*)` }).from(feedback).where(isNull(feedback.readAt)),
    db.select({ n: sql<number>`count(distinct ${versionPings.device})` }).from(versionPings).where(gte(versionPings.day, since)),
  ]);
  const bySource: Record<string, number> = {};
  for (const v of views) bySource[v.source] = Number(v.n);
  return {
    views: Object.values(bySource).reduce((a, b) => a + b, 0),
    viewsBySource: bySource,
    unreadFeedback: Number(unread[0]?.n ?? 0),
    activeDevices: Number(devices[0]?.n ?? 0),
  };
}

export { apps };
