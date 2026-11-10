import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { media } from "@/db/schema";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return new Response("Not found", { status: 404 });
  await dbReady();
  const m = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!m) return new Response("Not found", { status: 404 });
  const etag = `"${id}"`;
  const headers = {
    "Content-Type": m.mime,
    "Cache-Control": "public, max-age=31536000, immutable", // ids are random and content never changes
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(m.data), { headers: { ...headers, "Content-Length": String(m.bytes) } });
}
