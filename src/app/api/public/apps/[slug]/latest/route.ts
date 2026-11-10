import { NextResponse } from "next/server";
import { after } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, releases } from "@/db/schema";
import { redeemToken } from "@/lib/beta";
import { env } from "@/lib/env";
import { findPublicApp } from "@/lib/public-app";
import { recordVersionPing } from "@/lib/stats";
import { compareVersions, displayVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Update check for apps distributed through AppDrop.
 * GET /api/public/apps/:slug/latest?current=1.2.0&device=<random-install-id>&beta=<invite-token>
 * - current: the installed versionName → response includes updateAvailable
 * - device: random per-install id (hashed server-side) → anonymous "active devices by version" stats
 * - beta: a beta invite token → prereleases count as "latest"
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const app = await findPublicApp(slug);
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404, headers: CORS });

  const q = new URL(req.url).searchParams;
  const current = (q.get("current") ?? "").slice(0, 50);
  const device = (q.get("device") ?? "").slice(0, 64);
  const betaToken = q.get("beta");
  const allowPre = app.includePrereleases || (betaToken ? (await redeemToken(betaToken, false)) !== null : false);

  const [row] = await db
    .select({ r: releases, a: assets })
    .from(releases)
    .leftJoin(assets, and(eq(assets.releaseId, releases.id), eq(assets.isPrimary, true)))
    .where(and(eq(releases.appId, app.id), allowPre ? undefined : eq(releases.prerelease, false)))
    .orderBy(desc(releases.publishedAt))
    .limit(1);

  if (current && device) after(() => recordVersionPing(app.id, device, current).catch(() => {}));

  const base = env.siteUrl;
  const body = {
    slug: app.slug,
    name: app.name,
    kind: app.kind,
    pageUrl: `${base}/apps/${app.slug}?via=app`,
    latest: row
      ? {
          version: displayVersion(row.r.tag),
          tag: row.r.tag,
          prerelease: row.r.prerelease,
          publishedAt: row.r.publishedAt.toISOString(),
          notes: row.r.body.slice(0, 5000),
          apk: row.a
            ? { url: `${base}/d/${app.slug}/${row.a.id}`, name: row.a.name, size: row.a.size, sha256: row.a.digest?.replace(/^sha256:/, "") ?? null }
            : null,
        }
      : null,
    updateAvailable: row && current ? compareVersions(row.r.tag, current) > 0 : null,
  };
  return NextResponse.json(body, {
    headers: { ...CORS, "Cache-Control": current && device ? "no-store" : "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
