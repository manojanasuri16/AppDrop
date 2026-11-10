import { apiError, authorize, findApp, json, readImageBody, setIcon } from "@/lib/api";

export const dynamic = "force-dynamic";

/** PUT /api/v1/apps/:slug/icon — raw PNG/JPEG/WebP body (≤ 4 MB). Replaces the icon. */
export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await authorize(req);
  if (denied) return denied;
  const app = await findApp((await ctx.params).slug);
  if (!app) return apiError(404, "App not found");
  const body = await readImageBody(req);
  if (typeof body === "string") return apiError(413, body);
  try {
    const id = await setIcon(app, body);
    return json({ ok: true, url: `/media/${id}` });
  } catch (e) {
    return apiError(415, (e as Error).message);
  }
}
