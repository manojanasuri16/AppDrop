import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, dbReady } from "@/db";
import { apps, assets, releases } from "@/db/schema";
import { isAdmin } from "./auth";
import { isBetaViewer } from "./beta";
import { env } from "./env";
import { resolveAssetDownload, GitHubError } from "./github";
import { recordDownload } from "./queries";

const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };

function isPrefetch(req: NextRequest) {
  const p = `${req.headers.get("purpose") ?? ""} ${req.headers.get("sec-purpose") ?? ""}`.toLowerCase();
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return p.includes("prefetch") || /bot|crawler|spider|preview|slurp|facebookexternalhit/.test(ua);
}

function fail(status: number, message: string) {
  return new NextResponse(message, { status, headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });
}

export function safeWebUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost") ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a download for /d/[slug] (latest) or /d/[slug]/[assetId] (specific version).
 * The asset is always looked up through the app's own release rows, so callers can never
 * reach an asset from another repository the token can see (no IDOR).
 */
export async function handleDownload(req: NextRequest, slug: string, assetIdParam?: string) {
  await dbReady();
  const app = await db.query.apps.findFirst({ where: eq(apps.slug, slug) });
  if (!app || (app.visibility === "draft" && !(await isAdmin()))) return fail(404, "Not found");
  const count = !isPrefetch(req);

  if (app.kind === "web") {
    if (assetIdParam !== undefined) return fail(404, "Not found");
    const url = safeWebUrl(app.webUrl);
    if (!url) return fail(404, "This web app has no link yet");
    if (count) await recordDownload(app.id, null, null);
    return NextResponse.redirect(url, { status: 302, headers: noStore });
  }

  // Prerelease builds are only served to beta testers/admins, unless the app opts in for everyone.
  const allowPre = app.includePrereleases || (await isBetaViewer());
  let asset;
  if (assetIdParam !== undefined) {
    const id = Number(assetIdParam);
    if (!Number.isSafeInteger(id) || id <= 0) return fail(400, "Bad request");
    const [row] = await db
      .select({ a: assets, pre: releases.prerelease })
      .from(assets)
      .innerJoin(releases, eq(releases.id, assets.releaseId))
      .where(and(eq(assets.id, id), eq(assets.appId, app.id)))
      .limit(1);
    asset = row && (!row.pre || allowPre) ? row.a : undefined;
  } else {
    const [row] = await db
      .select({ a: assets })
      .from(assets)
      .innerJoin(releases, eq(releases.id, assets.releaseId))
      .where(and(eq(assets.appId, app.id), eq(assets.isPrimary, true), allowPre ? undefined : eq(releases.prerelease, false)))
      .orderBy(desc(releases.publishedAt))
      .limit(1);
    asset = row?.a;
  }
  if (!asset) return fail(404, "No downloadable APK found");

  try {
    let target: { type: "redirect"; url: string } | { type: "stream"; res: Response };
    if (!app.repoPrivate && !env.githubToken) {
      target = { type: "redirect", url: asset.browserDownloadUrl };
    } else {
      target = await resolveAssetDownload(app.repoOwner, app.repoName, asset.id);
    }
    if (count) await recordDownload(app.id, asset.releaseId, asset.id);

    // ?stream=1: the in-app downloader needs a same-origin body with Content-Length to show real progress.
    if (target.type === "redirect" && req.nextUrl.searchParams.get("stream") === "1") {
      const upstream = await fetch(target.url, { cache: "no-store", signal: AbortSignal.timeout(280_000) });
      if (!upstream.ok || !upstream.body) throw new GitHubError(`Upstream ${upstream.status}`, 502);
      target = { type: "stream", res: upstream };
    }
    if (target.type === "redirect") return NextResponse.redirect(target.url, { status: 302, headers: noStore });

    const filename = asset.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const h = new Headers(noStore);
    h.set("Content-Type", "application/vnd.android.package-archive");
    h.set("Content-Disposition", `attachment; filename="${filename}"`);
    const len = target.res.headers.get("content-length");
    if (len) h.set("Content-Length", len);
    return new NextResponse(target.res.body, { status: 200, headers: h });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return fail(404, "This file is no longer available");
    console.error("[download]", slug, e);
    return fail(502, "Download temporarily unavailable. Please try again.");
  }
}
