import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { env } from "@/lib/env";
import { rateLimit, requestKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Paginated database export for scheduled backups (GitHub Actions).
 *   GET /api/backup                         → { version, tables: {name: rows} }
 *   GET /api/backup?table=apps&after=0      → { rows: [...], next: <rowid|null> }
 * Auth: Bearer BACKUP_TOKEN (disabled unless set). Blobs are base64 ({"$b64": "..."}).
 * Pages stay well under Vercel's ~4.5 MB response cap (media is exported one row at a time).
 */
const TABLES: Record<string, number> = {
  _migrations: 500, apps: 200, media: 1, screenshots: 500, releases: 300, assets: 500, downloads: 2000,
  feedback: 500, beta_invites: 500, push_subscriptions: 1000, version_pings: 2000, page_views: 2000,
};
const sha = (s: string) => createHash("sha256").update(s).digest();

export async function GET(req: Request) {
  const token = env.backupToken;
  if (!token) return NextResponse.json({ error: "Backups are disabled (BACKUP_TOKEN not set)" }, { status: 404 });
  const key = await requestKey("backup", req);
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m || !timingSafeEqual(sha(m[1].trim()), sha(token))) {
    await rateLimit(key, 1000, 60); // record the failure
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbReady();
  const q = new URL(req.url).searchParams;
  const table = q.get("table");
  const headers = { "Cache-Control": "no-store" };

  if (!table) {
    const counts: Record<string, number> = {};
    for (const t of Object.keys(TABLES)) {
      const r = await db.all<{ n: number }>(sql.raw(`SELECT COUNT(*) AS n FROM "${t}"`));
      counts[t] = Number(r[0]?.n ?? 0);
    }
    return NextResponse.json({ version: 1, exportedAt: new Date().toISOString(), tables: counts }, { headers });
  }
  const limit = TABLES[table];
  if (!limit) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  const after = Math.max(0, Number(q.get("after") ?? 0) || 0);
  // Table name comes from the allowlist above; the cursor is a parsed integer.
  const rows = await db.all<Record<string, unknown>>(
    sql.raw(`SELECT rowid AS "__rowid", * FROM "${table}" WHERE rowid > ${after} ORDER BY rowid LIMIT ${limit}`),
  );
  const out = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v instanceof ArrayBuffer) o[k] = { $b64: Buffer.from(v).toString("base64") };
      else if (ArrayBuffer.isView(v)) o[k] = { $b64: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64") };
      else if (typeof v === "bigint") o[k] = Number(v);
      else o[k] = v;
    }
    return o;
  });
  const last = out.at(-1)?.__rowid;
  return NextResponse.json({ table, rows: out, next: out.length === limit ? Number(last) : null }, { headers });
}
