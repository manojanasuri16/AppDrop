import type { NextRequest } from "next/server";
import { handleDownload } from "@/lib/download";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return handleDownload(req, slug);
}
