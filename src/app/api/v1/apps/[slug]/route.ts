import { apiError, appSummary, authorize, findApp, json, upsertApp } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/v1/apps/:slug — app summary (versions, screenshots count, sync status). */
export async function GET(req: Request, ctx: Ctx) {
  const denied = await authorize(req);
  if (denied) return denied;
  const app = await findApp((await ctx.params).slug);
  if (!app) return apiError(404, "App not found");
  return json({ app: await appSummary(app.id, new URL(req.url).origin) });
}

/** PUT /api/v1/apps/:slug — create or update (JSON). Omitted fields are left unchanged. */
export async function PUT(req: Request, ctx: Ctx) {
  const denied = await authorize(req);
  if (denied) return denied;
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Body must be JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError(400, "Body must be a JSON object");
  const r = await upsertApp(slug, body as Record<string, unknown>);
  if ("error" in r) return apiError(422, r.error!, "fields" in r ? r.fields : undefined);
  return json({ created: r.created, sync: r.sync, app: await appSummary(r.id, new URL(req.url).origin) }, r.created ? 201 : 200);
}
