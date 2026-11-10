import { NextResponse } from "next/server";
import { submitFeedback } from "@/lib/feedback";
import { findPublicApp } from "@/lib/public-app";
import { rateLimit, requestKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/apps/:slug/feedback  JSON {message, name?, contact?, version?, source?: "app"}
 * Used by the store's feedback form and directly by Android apps. Rate-limited per client.
 * Same-origin only for browsers (no CORS headers), so other websites can't post through visitors.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const app = await findPublicApp(slug);
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > 20_000) return NextResponse.json({ error: "Too large" }, { status: 413 });

  if (!(await rateLimit(await requestKey("fb", req), 5, 15 * 60))) {
    return NextResponse.json({ error: "Too many messages. Please try again in a few minutes." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const r = await submitFeedback(app, body, body?.source === "app" ? "app" : "web");
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error, fields: r.fields }, { status: 422 });
}
