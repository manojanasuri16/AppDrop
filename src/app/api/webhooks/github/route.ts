import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { apps } from "@/db/schema";
import { env } from "@/lib/env";
import { syncApp } from "@/lib/sync";

/** GitHub "release" webhook → instant resync. Configure with content type application/json and GITHUB_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const secret = env.githubWebhookSecret;
  if (!secret) return new Response("Webhooks not configured", { status: 404 });
  const body = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Invalid signature", { status: 401 });

  const event = req.headers.get("x-github-event");
  if (event === "ping") return Response.json({ ok: true });
  if (event !== "release") return Response.json({ ignored: event });

  let payload: { repository?: { name?: string; owner?: { login?: string } } };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const owner = payload.repository?.owner?.login, name = payload.repository?.name;
  if (!owner || !name) return new Response("Bad payload", { status: 400 });

  await dbReady();
  const matches = await db
    .select({ id: apps.id })
    .from(apps)
    .where(and(eq(apps.repoOwner, owner), eq(apps.repoName, name)));
  const results = await Promise.all(matches.map((m) => syncApp(m.id)));
  return Response.json({ synced: results.length });
}
