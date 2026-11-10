import { asc } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { authorize, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/apps — list every app (any visibility). */
export async function GET(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;
  const rows = await db
    .select({ slug: apps.slug, name: apps.name, kind: apps.kind, visibility: apps.visibility, repoOwner: apps.repoOwner, repoName: apps.repoName, webUrl: apps.webUrl })
    .from(apps)
    .orderBy(asc(apps.sortOrder), asc(apps.name));
  return json({
    apps: rows.map((r) => ({ slug: r.slug, name: r.name, kind: r.kind, visibility: r.visibility, repo: r.repoOwner ? `${r.repoOwner}/${r.repoName}` : null, webUrl: r.webUrl || null })),
  });
}
