import { NextResponse } from "next/server";
import { clearBetaCookie } from "@/lib/beta";

export const dynamic = "force-dynamic";

/** POST /beta/leave → leave the beta channel (POST so links/prefetchers can't trigger it). */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return new Response("Forbidden", { status: 403 });
  await clearBetaCookie();
  return NextResponse.redirect(new URL("/?beta=left", new URL(req.url).origin), { status: 303 });
}
