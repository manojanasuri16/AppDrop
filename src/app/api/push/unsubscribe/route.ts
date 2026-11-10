import { NextResponse } from "next/server";
import { isAllowedEndpoint, unsubscribe } from "@/lib/push";
import { resolveTopic } from "@/lib/push-topic";

export const dynamic = "force-dynamic";

/** POST {endpoint, topic?} — omit topic to remove the device from everything. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { endpoint?: unknown; topic?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!isAllowedEndpoint(endpoint)) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  if (body.topic === undefined) await unsubscribe(endpoint);
  else {
    const topic = await resolveTopic(body.topic);
    if (!topic) return NextResponse.json({ error: "Unknown topic" }, { status: 400 });
    await unsubscribe(endpoint, topic);
  }
  return NextResponse.json({ ok: true });
}
