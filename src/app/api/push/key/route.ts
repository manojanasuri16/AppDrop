import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push";

/** GET /api/push/key → VAPID public key for PushManager.subscribe (null when push isn't configured). */
export function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() }, { headers: { "Cache-Control": "public, max-age=300" } });
}
