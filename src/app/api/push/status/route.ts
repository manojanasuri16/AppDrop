import { NextResponse } from "next/server";
import { isAllowedEndpoint, pushEnabled, topicsFor } from "@/lib/push";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** POST {endpoint} → {enabled, topics: ["all" | "admin" | "app:<slug>"]} — the endpoint itself acts as the secret. */
export async function POST(req: Request) {
  if (!pushEnabled()) return NextResponse.json({ enabled: false, topics: [] });
  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!isAllowedEndpoint(endpoint)) return NextResponse.json({ enabled: true, topics: [] });
  const raw = await topicsFor(endpoint);
  const ids = raw.filter((t) => t.startsWith("app:")).map((t) => Number(t.slice(4)));
  const slugs = ids.length ? await db.select({ id: apps.id, slug: apps.slug }).from(apps).where(inArray(apps.id, ids)) : [];
  const bySlug = new Map(slugs.map((s) => [s.id, s.slug]));
  return NextResponse.json({
    enabled: true,
    topics: raw.map((t) => (t.startsWith("app:") ? `app:${bySlug.get(Number(t.slice(4))) ?? "?"}` : t)),
  });
}
