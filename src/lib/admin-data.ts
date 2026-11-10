import "server-only";
import { desc, eq, isNull } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { apps, betaInvites, feedback } from "@/db/schema";
import { countByTopic, pushEnabled } from "./push";

/** Admin-only loaders. Callers MUST have run requireAdmin() first. */
export async function listFeedback(opts: { unreadOnly?: boolean; appId?: number } = {}) {
  await dbReady();
  const rows = await db
    .select({
      id: feedback.id, message: feedback.message, name: feedback.name, contact: feedback.contact,
      appVersion: feedback.appVersion, source: feedback.source, createdAt: feedback.createdAt, readAt: feedback.readAt,
      appId: apps.id, appName: apps.name, appSlug: apps.slug, appIcon: apps.iconMediaId, accentColor: apps.accentColor,
    })
    .from(feedback)
    .innerJoin(apps, eq(apps.id, feedback.appId))
    .where(opts.unreadOnly ? isNull(feedback.readAt) : opts.appId ? eq(feedback.appId, opts.appId) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, appIconUrl: r.appIcon ? `/media/${r.appIcon}` : null }));
}

export async function listInvites() {
  await dbReady();
  return db
    .select({
      id: betaInvites.id, label: betaInvites.label, uses: betaInvites.uses, createdAt: betaInvites.createdAt,
      lastUsedAt: betaInvites.lastUsedAt, revokedAt: betaInvites.revokedAt,
    })
    .from(betaInvites)
    .orderBy(desc(betaInvites.createdAt));
}

export async function pushOverview() {
  return { enabled: pushEnabled(), counts: pushEnabled() ? await countByTopic() : {} };
}
