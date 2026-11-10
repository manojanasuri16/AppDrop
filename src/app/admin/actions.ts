"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, dbReady } from "@/db";
import { apps, media, screenshots, releases, assets, downloads } from "@/db/schema";
import {
  clearFailedLogins, clientKey, consumeTotp, createSession, destroySession, loginThrottle,
  passwordMatches, recordFailedLogin, requireAdmin, totpConfigured,
} from "@/lib/auth";
import { getRepo, getRepoFile, listAccessibleRepos, listRepoDir, GitHubError } from "@/lib/github";
import { storeImage, storeImageFile, MAX_IMAGE_BYTES } from "@/lib/media";
import { syncApp } from "@/lib/sync";
import { appFields, parseRepo, slugify } from "@/lib/validate";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

/* ─── Session ───────────────────────────────────────────────────────────── */

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (!totpConfigured()) {
    return { error: "Two-factor login isn't set up. Run `npm run totp:setup` and set ADMIN_TOTP_SECRET." };
  }
  const k = await clientKey();
  const wait = await loginThrottle(k);
  if (wait) return { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` };
  const password = String(form.get("password") ?? "");
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  // Check the password first, but only consume the code if the password is right, so a wrong guess can't burn a valid code.
  // Always reply with the same message so nobody can tell which factor failed.
  const pwOk = !!password && password.length <= 512 && passwordMatches(password);
  const codeOk = pwOk && /^\d{6}$/.test(code) && (await consumeTotp(code));
  if (!pwOk || !codeOk) {
    await recordFailedLogin(k);
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Incorrect password or code." };
  }
  await clearFailedLogins(k);
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function readFields(form: FormData) {
  const str = (k: string) => (form.get(k) === null ? undefined : String(form.get(k)));
  const bool = (k: string) => form.get(k) === "on" || form.get(k) === "true";
  const raw = {
    kind: str("kind"),
    name: str("name"),
    slug: str("slug") || slugify(str("name") ?? ""),
    tagline: str("tagline"),
    description: str("description"),
    category: str("category"),
    developer: str("developer"),
    accentColor: str("accentColor"),
    packageName: str("packageName"),
    repo: str("repo"),
    webUrl: str("webUrl"),
    assetPattern: str("assetPattern"),
    includePrereleases: bool("includePrereleases"),
    visibility: str("visibility"),
    featured: bool("featured"),
    sortOrder: str("sortOrder") || 0,
  };
  const parsed = appFields.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors } as const;
  }
  return { data: parsed.data } as const;
}

async function slugTaken(slug: string, exceptId?: number) {
  const r = await db
    .select({ id: apps.id })
    .from(apps)
    .where(exceptId ? and(eq(apps.slug, slug), ne(apps.id, exceptId)) : eq(apps.slug, slug))
    .limit(1);
  return r.length > 0;
}

function files(form: FormData, key: string): File[] {
  return form.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}

function touch(slug?: string) {
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/apps/${slug}`);
}

/* ─── Apps ──────────────────────────────────────────────────────────────── */

export async function createApp(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  await dbReady();
  const r = readFields(form);
  if ("error" in r) return { error: r.error, fieldErrors: r.fieldErrors };
  const d = r.data;
  if (await slugTaken(d.slug)) return { error: "That URL slug is already used.", fieldErrors: { slug: "Already used" } };

  const repo = d.repo ? parseRepo(d.repo)! : null;
  let repoPrivate = false;
  let description = d.description;
  if (repo) {
    try {
      const info = await getRepo(repo.owner, repo.repo);
      repoPrivate = info.private;
      if (!description && info.description) description = info.description;
    } catch (e) {
      return { error: e instanceof GitHubError ? e.message : "Could not reach GitHub", fieldErrors: { repo: "Not accessible" } };
    }
  }

  const [row] = await db
    .insert(apps)
    .values({
      kind: d.kind, name: d.name, slug: d.slug, tagline: d.tagline, description, category: d.category,
      developer: d.developer, accentColor: d.accentColor, packageName: d.packageName,
      repoOwner: repo?.owner ?? "", repoName: repo?.repo ?? "", repoPrivate,
      webUrl: d.webUrl, assetPattern: d.assetPattern, includePrereleases: d.includePrereleases,
      visibility: d.visibility, featured: d.featured, sortOrder: d.sortOrder,
    })
    .returning({ id: apps.id });

  const icon = files(form, "icon")[0];
  if (icon) {
    try {
      const id = await storeImageFile(icon);
      await db.update(apps).set({ iconMediaId: id }).where(eq(apps.id, row.id));
    } catch {}
  }
  if (repo) await syncApp(row.id);
  touch(d.slug);
  redirect(`/admin/apps/${row.id}`);
}

export async function updateApp(appId: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  await dbReady();
  const current = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!current) return { error: "App not found" };
  const r = readFields(form);
  if ("error" in r) return { error: r.error, fieldErrors: r.fieldErrors };
  const d = r.data;
  if (await slugTaken(d.slug, appId)) return { error: "That URL slug is already used.", fieldErrors: { slug: "Already used" } };

  const repo = d.repo ? parseRepo(d.repo)! : null;
  const repoChanged = (repo?.owner ?? "") !== current.repoOwner || (repo?.repo ?? "") !== current.repoName;
  let repoPrivate = current.repoPrivate;
  if (repo && repoChanged) {
    try {
      repoPrivate = (await getRepo(repo.owner, repo.repo)).private;
    } catch (e) {
      return { error: e instanceof GitHubError ? e.message : "Could not reach GitHub", fieldErrors: { repo: "Not accessible" } };
    }
  }

  const set: Partial<typeof apps.$inferInsert> = {
    kind: d.kind, name: d.name, slug: d.slug, tagline: d.tagline, description: d.description,
    category: d.category, developer: d.developer, accentColor: d.accentColor, packageName: d.packageName,
    repoOwner: repo?.owner ?? "", repoName: repo?.repo ?? "", repoPrivate, webUrl: d.webUrl,
    assetPattern: d.assetPattern, includePrereleases: d.includePrereleases, visibility: d.visibility,
    featured: d.featured, sortOrder: d.sortOrder, updatedAt: new Date(),
  };

  const icon = files(form, "icon")[0];
  if (icon) {
    try {
      set.iconMediaId = await storeImageFile(icon);
    } catch (e) {
      return { error: (e as Error).message, fieldErrors: { icon: (e as Error).message } };
    }
  }

  await db.update(apps).set(set).where(eq(apps.id, appId));
  if (icon && current.iconMediaId) await db.delete(media).where(eq(media.id, current.iconMediaId));

  const needsResync =
    repoChanged || d.assetPattern !== current.assetPattern || d.includePrereleases !== current.includePrereleases || d.kind !== current.kind;
  if (repoChanged) {
    await db.delete(assets).where(eq(assets.appId, appId));
    await db.delete(releases).where(eq(releases.appId, appId));
  }
  if (repo && needsResync) await syncApp(appId);

  touch(current.slug);
  touch(d.slug);
  return { ok: true, message: "Saved" };
}

export async function setVisibility(appId: number, visibility: "public" | "unlisted" | "draft") {
  await requireAdmin();
  if (!["public", "unlisted", "draft"].includes(visibility)) return;
  await db.update(apps).set({ visibility, updatedAt: new Date() }).where(eq(apps.id, appId));
  touch();
}

export async function setFeatured(appId: number, featured: boolean) {
  await requireAdmin();
  await db.update(apps).set({ featured: !!featured }).where(eq(apps.id, appId));
  touch();
}

export async function syncNow(appId: number): Promise<ActionState> {
  await requireAdmin();
  const r = await syncApp(appId);
  touch();
  return r.ok ? { ok: true, message: `Synced ${r.releases} release${r.releases === 1 ? "" : "s"}` } : { error: r.error };
}

export async function syncAll(): Promise<ActionState> {
  await requireAdmin();
  await dbReady();
  const rows = await db.select({ id: apps.id }).from(apps).where(ne(apps.repoOwner, ""));
  const results = await Promise.all(rows.map((r) => syncApp(r.id)));
  touch();
  const failed = results.filter((r) => !r.ok).length;
  return failed ? { error: `${failed} of ${results.length} failed to sync` } : { ok: true, message: `Synced ${results.length} apps` };
}

export async function deleteApp(appId: number) {
  await requireAdmin();
  await dbReady();
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app) redirect("/admin");
  const shots = await db.select({ mediaId: screenshots.mediaId }).from(screenshots).where(eq(screenshots.appId, appId));
  const mediaIds = [...shots.map((s) => s.mediaId), ...(app.iconMediaId ? [app.iconMediaId] : [])];
  await db.batch([
    db.delete(downloads).where(eq(downloads.appId, appId)),
    db.delete(assets).where(eq(assets.appId, appId)),
    db.delete(releases).where(eq(releases.appId, appId)),
    db.delete(screenshots).where(eq(screenshots.appId, appId)),
    db.delete(apps).where(eq(apps.id, appId)),
  ]);
  if (mediaIds.length) await db.delete(media).where(inArray(media.id, mediaIds));
  touch(app.slug);
  redirect("/admin");
}

/* ─── Screenshots ───────────────────────────────────────────────────────── */

export async function addScreenshots(appId: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  await dbReady();
  const list = files(form, "screenshots").slice(0, 12);
  if (!list.length) return { error: "Choose at least one image" };
  if (list.some((f) => f.size > MAX_IMAGE_BYTES)) return { error: "Each image must be under 4 MB" };
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${screenshots.position}), -1)` })
    .from(screenshots)
    .where(eq(screenshots.appId, appId));
  let pos = Number(max) + 1;
  try {
    for (const f of list) {
      const mediaId = await storeImageFile(f);
      await db.insert(screenshots).values({ appId, mediaId, position: pos++ });
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  touch();
  return { ok: true, message: `Added ${list.length} screenshot${list.length === 1 ? "" : "s"}` };
}

export async function removeScreenshot(appId: number, mediaId: string) {
  await requireAdmin();
  await db.delete(screenshots).where(and(eq(screenshots.appId, appId), eq(screenshots.mediaId, mediaId)));
  await db.delete(media).where(eq(media.id, mediaId));
  touch();
}

/** Reorder by passing the full list of media ids in the desired order. */
export async function reorderScreenshots(appId: number, mediaIds: string[]) {
  await requireAdmin();
  if (!Array.isArray(mediaIds) || mediaIds.length > 50) return;
  await db.batch(
    mediaIds.map((m, i) =>
      db.update(screenshots).set({ position: i }).where(and(eq(screenshots.appId, appId), eq(screenshots.mediaId, String(m)))),
    ) as [any, ...any[]],
  );
  touch();
}

/* ─── GitHub helpers for the admin UI ───────────────────────────────────── */

export type RepoOption = { fullName: string; private: boolean; description: string; homepage: string; pushedAt: string };

export async function fetchRepos(): Promise<{ repos: RepoOption[]; error?: string }> {
  await requireAdmin();
  try {
    const list = await listAccessibleRepos();
    return {
      repos: list.map((r) => ({
        fullName: r.full_name, private: r.private, description: r.description ?? "", homepage: r.homepage ?? "", pushedAt: r.pushed_at,
      })),
    };
  } catch (e) {
    return { repos: [], error: e instanceof GitHubError ? e.message : "Could not list repositories" };
  }
}

/**
 * Import store metadata from the repo's fastlane structure (the F-Droid / Play convention):
 * fastlane/metadata/android/<locale>/{title.txt,short_description.txt,full_description.txt,images/icon.png,images/phoneScreenshots/*}
 * Only fills empty fields; screenshots are added only if the app has none.
 */
export async function importFromRepo(appId: number): Promise<ActionState> {
  await requireAdmin();
  await dbReady();
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app?.repoOwner) return { error: "Connect a repository first" };
  const { repoOwner: o, repoName: r } = app;
  try {
    const locales = await listRepoDir(o, r, "fastlane/metadata/android");
    const loc = locales.find((l) => l.name === "en-US") ?? locales.find((l) => l.name.startsWith("en")) ?? locales[0];
    if (!loc) return { error: "No fastlane/metadata/android folder found in the repository" };
    const base = `fastlane/metadata/android/${loc.name}`;
    const text = async (p: string) => (await getRepoFile(o, r, `${base}/${p}`))?.toString("utf8").trim() ?? "";
    const [title, short, full] = await Promise.all([text("title.txt"), text("short_description.txt"), text("full_description.txt")]);
    const set: Partial<typeof apps.$inferInsert> = {};
    if (title && (!app.name || app.name === app.repoName)) set.name = title.slice(0, 80);
    if (short && !app.tagline) set.tagline = short.slice(0, 120);
    if (full && !app.description) set.description = full.slice(0, 20_000);
    const imported: string[] = Object.keys(set);

    if (!app.iconMediaId) {
      const icon = (await getRepoFile(o, r, `${base}/images/icon.png`)) ?? (await getRepoFile(o, r, `${base}/images/icon.jpg`));
      if (icon) {
        try {
          set.iconMediaId = await storeImage(icon);
          imported.push("icon");
        } catch {}
      }
    }
    if (Object.keys(set).length) await db.update(apps).set({ ...set, updatedAt: new Date() }).where(eq(apps.id, appId));

    const existing = await db.select({ id: screenshots.id }).from(screenshots).where(eq(screenshots.appId, appId)).limit(1);
    if (!existing.length) {
      const shots = (await listRepoDir(o, r, `${base}/images/phoneScreenshots`))
        .filter((f) => f.type === "file" && /\.(png|jpe?g|webp)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .slice(0, 10);
      let pos = 0;
      for (const s of shots) {
        const buf = await getRepoFile(o, r, s.path);
        if (!buf) continue;
        try {
          const mediaId = await storeImage(buf);
          await db.insert(screenshots).values({ appId, mediaId, position: pos++ });
        } catch {}
      }
      if (pos) imported.push(`${pos} screenshots`);
    }
    touch(app.slug);
    return imported.length ? { ok: true, message: `Imported ${imported.join(", ")}` } : { ok: true, message: "Nothing new to import" };
  } catch (e) {
    return { error: e instanceof GitHubError ? e.message : "Import failed" };
  }
}
