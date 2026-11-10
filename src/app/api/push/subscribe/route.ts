import { NextResponse } from "next/server";
import { parseSubscription, pushEnabled, subscribe } from "@/lib/push";
import { resolveTopic } from "@/lib/push-topic";
import { rateLimit, requestKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** POST {subscription: PushSubscriptionJSON, topic: "all" | "app:<slug>" | "admin"} */
export async function POST(req: Request) {
  if (!pushEnabled()) return NextResponse.json({ error: "Notifications aren't set up yet" }, { status: 503 });
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit(await requestKey("push", req), 30, 60 * 60))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  let body: { subscription?: unknown; topic?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const sub = parseSubscription(body.subscription);
  if (!sub) return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  const topic = await resolveTopic(body.topic);
  if (!topic) return NextResponse.json({ error: "Unknown topic" }, { status: 400 });
  await subscribe(sub, topic);
  return NextResponse.json({ ok: true });
}
