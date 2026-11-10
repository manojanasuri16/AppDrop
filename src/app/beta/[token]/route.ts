import { NextResponse } from "next/server";
import { redeemToken, setBetaCookie } from "@/lib/beta";
import { rateLimit, requestKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Beta invite link: /beta/<token> → sets the beta cookie and lands on the store. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const base = new URL(req.url).origin;
  const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
  if (!(await rateLimit(await requestKey("beta", req), 20, 15 * 60))) {
    return NextResponse.redirect(new URL("/?beta=error", base), { status: 303, headers: noStore });
  }
  const id = await redeemToken((await ctx.params).token);
  if (!id) return NextResponse.redirect(new URL("/?beta=invalid", base), { status: 303, headers: noStore });
  await setBetaCookie(id);
  return NextResponse.redirect(new URL("/?beta=joined", base), { status: 303, headers: noStore });
}
