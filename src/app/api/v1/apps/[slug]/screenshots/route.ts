import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { screenshots } from "@/db/schema";
import { apiError, authorize, clearScreenshots, findApp, json, readImageBody, touch } from "@/lib/api";
import { storeImage } from "@/lib/media";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };
const MAX_SCREENSHOTS = 12;

/** POST /api/v1/apps/:slug/screenshots — append one screenshot (raw image body, ≤ 4 MB). */
export async function POST(req: Request, ctx: Ctx) {
  const denied = await authorize(req);
  if (denied) return denied;
  const app = await findApp((await ctx.params).slug);
  if (!app) return apiError(404, "App not found");
  const [{ n, max }] = await db
    .select({ n: sql<number>`count(*)`, max: sql<number>`coalesce(max(${screenshots.position}), -1)` })
    .from(screenshots)
    .where(eq(screenshots.appId, app.id));
  if (Number(n) >= MAX_SCREENSHOTS) return apiError(409, `An app can have at most ${MAX_SCREENSHOTS} screenshots`);
  const body = await readImageBody(req);
  if (typeof body === "string") return apiError(413, body);
  try {
    const mediaId = await storeImage(body);
    await db.insert(screenshots).values({ appId: app.id, mediaId, position: Number(max) + 1 });
    touch(app.slug);
    return json({ ok: true, url: `/media/${mediaId}`, position: Number(max) + 1 }, 201);
  } catch (e) {
    return apiError(415, (e as Error).message);
  }
}

/** DELETE /api/v1/apps/:slug/screenshots — remove all screenshots (used before re-uploading a fresh set). */
export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await authorize(req);
  if (denied) return denied;
  const app = await findApp((await ctx.params).slug);
  if (!app) return apiError(404, "App not found");
  return json({ ok: true, removed: await clearScreenshots(app) });
}
