import "server-only";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { apps, type App } from "@/db/schema";

/** Public lookup: public + unlisted apps only (drafts are invisible to every public endpoint). */
export async function findPublicApp(slug: string): Promise<App | undefined> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return undefined;
  await dbReady();
  const a = await db.query.apps.findFirst({ where: eq(apps.slug, slug) });
  return a && a.visibility !== "draft" ? a : undefined;
}
