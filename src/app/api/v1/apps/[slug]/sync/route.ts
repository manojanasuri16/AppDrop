import { apiError, appSummary, authorize, findApp, json, touch } from "@/lib/api";
import { syncApp } from "@/lib/sync";

export const dynamic = "force-dynamic";

/** POST /api/v1/apps/:slug/sync — pull releases from GitHub now (call after publishing a release). */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await authorize(req);
  if (denied) return denied;
  const app = await findApp((await ctx.params).slug);
  if (!app) return apiError(404, "App not found");
  if (!app.repoOwner) return apiError(400, "App has no GitHub repository");
  const result = await syncApp(app.id);
  touch(app.slug);
  return json({ sync: result, app: await appSummary(app.id, new URL(req.url).origin) }, result.ok ? 200 : 502);
}
