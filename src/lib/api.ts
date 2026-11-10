import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { apps, media, screenshots, assets, releases, type App } from "@/db/schema";
import { env } from "./env";
import { clearFailedLogins, loginThrottle, recordFailedLogin } from "./auth";
import { getRepo, GitHubError } from "./github";
import { storeImage, MAX_IMAGE_BYTES } from "./media";
import { syncApp } from "./sync";
import { appFields, parseRepo } from "./validate";
import { getAppById } from "./queries";

/**
 * Publishing API (/api/v1) for the AppDrop CLI / Claude Code.
 * - Bearer APPDROP_API_KEY; disabled entirely (404) when unset.
 * - Can create and update apps, media and trigger syncs. It can NOT delete apps,
 *   read stats or sign in to the admin: destructive actions stay behind password + TOTP.
 * - Failed keys share the login rate limiter.
 */
const sha = (s: string) => createHash("sha256").update(s).digest();
const NO_STORE = { "Cache-Control": "no-store" };

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });
export const apiError = (status: number, error: string, details?: unknown) => json({ error, ...(details ? { details } : {}) }, status);

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** Returns an error response, or null when authorized. */
export async function authorize(req: Request): Promise<NextResponse | null> {
  const key = env.apiKey;
  if (!key) return apiError(404, "Publishing API is disabled. Set APPDROP_API_KEY (≥ 32 chars) on the server.");
  await dbReady();
  const rl = "api:" + createHash("sha256").update(clientIp(req) + env.sessionSecret).digest("hex").slice(0, 32);
  const wait = await loginThrottle(rl);
  if (wait) return apiError(429, `Too many failed attempts. Retry in ${wait}s.`);
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m || !timingSafeEqual(sha(m[1].trim()), sha(key))) {
    await recordFailedLogin(rl);
    return apiError(401, "Invalid or missing API key");
  }
  await clearFailedLogins(rl);
  return null;
}

export async function findApp(slug: string): Promise<App | undefined> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return undefined;
  return db.query.apps.findFirst({ where: eq(apps.slug, slug) });
}

export function touch(slug: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/apps/${slug}`);
}

/** Compact JSON view of an app for API responses. */
export async function appSummary(id: number, origin: string) {
  const a = await getAppById(id);
  if (!a) return null;
  return {
    slug: a.slug,
    name: a.name,
    kind: a.kind,
    visibility: a.visibility,
    featured: a.featured,
    url: `${origin}/apps/${a.slug}`,
    downloadUrl: `${origin}/d/${a.slug}`,
    repo: a.repoOwner ? `${a.repoOwner}/${a.repoName}` : null,
    repoPrivate: a.repoPrivate,
    webUrl: a.webUrl || null,
    hasIcon: !!a.iconUrl,
    screenshots: a.screenshots.length,
    latestVersion: a.latestVersion,
    releases: a.releases.length,
    downloads: a.downloads,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    syncError: a.syncError,
  };
}

const FIELD_KEYS = [
  "kind", "name", "tagline", "description", "category", "developer", "accentColor", "packageName",
  "repo", "webUrl", "assetPattern", "includePrereleases", "visibility", "featured", "sortOrder",
] as const;

/**
 * Create-or-update by slug. Omitted fields keep their current value (or schema defaults on create).
 * Returns { id, created, sync } or a validation error.
 */
export async function upsertApp(slug: string, body: Record<string, unknown>) {
  const existing = await findApp(slug);
  if (body.slug !== undefined && body.slug !== slug) {
    return { error: "Slug in body must match the URL (slugs can't be renamed via the API)" } as const;
  }
  const base: Record<string, unknown> = existing
    ? {
        kind: existing.kind, name: existing.name, tagline: existing.tagline, description: existing.description,
        category: existing.category, developer: existing.developer, accentColor: existing.accentColor,
        packageName: existing.packageName, repo: existing.repoOwner ? `${existing.repoOwner}/${existing.repoName}` : "",
        webUrl: existing.webUrl, assetPattern: existing.assetPattern, includePrereleases: existing.includePrereleases,
        visibility: existing.visibility, featured: existing.featured, sortOrder: existing.sortOrder,
      }
    : {};
  const input: Record<string, unknown> = { ...base, slug };
  for (const k of FIELD_KEYS) if (body[k] !== undefined && body[k] !== null) input[k] = body[k];
  if (!input.kind) input.kind = input.webUrl && !input.repo ? "web" : "android";

  const parsed = appFields.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? "body")] ??= i.message;
    return { error: "Validation failed", fields } as const;
  }
  const d = parsed.data;
  const clash = await db.select({ id: apps.id }).from(apps)
    .where(existing ? and(eq(apps.slug, d.slug), ne(apps.id, existing.id)) : eq(apps.slug, d.slug)).limit(1);
  if (clash.length) return { error: "Slug already in use" } as const;

  const repo = d.repo ? parseRepo(d.repo)! : null;
  const repoChanged = !existing || (repo?.owner ?? "") !== existing.repoOwner || (repo?.repo ?? "") !== existing.repoName;
  let repoPrivate = existing?.repoPrivate ?? false;
  let description = d.description;
  if (repo && repoChanged) {
    try {
      const info = await getRepo(repo.owner, repo.repo);
      repoPrivate = info.private;
      if (!description && info.description) description = info.description;
    } catch (e) {
      return { error: e instanceof GitHubError ? `${e.message} (${repo.owner}/${repo.repo})` : "Could not reach GitHub" } as const;
    }
  }

  const values = {
    kind: d.kind, name: d.name, slug: d.slug, tagline: d.tagline, description, category: d.category,
    developer: d.developer, accentColor: d.accentColor, packageName: d.packageName,
    repoOwner: repo?.owner ?? "", repoName: repo?.repo ?? "", repoPrivate, webUrl: d.webUrl,
    assetPattern: d.assetPattern, includePrereleases: d.includePrereleases, visibility: d.visibility,
    featured: d.featured, sortOrder: d.sortOrder,
  };

  let id: number;
  if (existing) {
    id = existing.id;
    await db.update(apps).set({ ...values, updatedAt: new Date() }).where(eq(apps.id, id));
    if (repoChanged) {
      await db.delete(assets).where(eq(assets.appId, id));
      await db.delete(releases).where(eq(releases.appId, id));
    }
  } else {
    [{ id }] = await db.insert(apps).values(values).returning({ id: apps.id });
  }

  const needsSync =
    !!repo && (repoChanged || !existing || d.assetPattern !== existing.assetPattern ||
      d.includePrereleases !== existing.includePrereleases || d.kind !== existing.kind);
  const sync = needsSync ? await syncApp(id) : null;
  touch(d.slug);
  return { id, created: !existing, sync } as const;
}

/** Read a raw image request body with a hard size cap (never trust Content-Length alone). */
export async function readImageBody(req: Request): Promise<Buffer | string> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES) return "Image must be under 4 MB";
  if (!req.body) return "Empty body";
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return "Image must be under 4 MB";
    }
    chunks.push(value);
  }
  return total ? Buffer.concat(chunks) : "Empty body";
}

export async function setIcon(app: App, buf: Buffer) {
  const id = await storeImage(buf);
  await db.update(apps).set({ iconMediaId: id, updatedAt: new Date() }).where(eq(apps.id, app.id));
  if (app.iconMediaId) await db.delete(media).where(eq(media.id, app.iconMediaId));
  touch(app.slug);
  return id;
}

export async function clearScreenshots(app: App) {
  const rows = await db.select({ mediaId: screenshots.mediaId }).from(screenshots).where(eq(screenshots.appId, app.id));
  await db.delete(screenshots).where(eq(screenshots.appId, app.id));
  for (const r of rows) await db.delete(media).where(eq(media.id, r.mediaId));
  touch(app.slug);
  return rows.length;
}
