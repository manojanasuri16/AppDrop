import type { NextRequest } from "next/server";
import { handleDownload } from "@/lib/download";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; assetId: string }> }) {
  const { slug, assetId } = await ctx.params;
  return handleDownload(req, slug, assetId);
}
