import { requireAdmin } from "@/lib/auth";
import { db, dbReady } from "@/db";
import { apps } from "@/db/schema";
import { listFeedback } from "@/lib/admin-data";
import { FeedbackInbox } from "@/components/admin/FeedbackInbox";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ filter?: string; app?: string }> }) {
  await requireAdmin();
  await dbReady();
  const sp = await searchParams;
  const appId = /^\d+$/.test(sp.app ?? "") ? Number(sp.app) : undefined;
  const unreadOnly = sp.filter === "unread";
  const [rows, all, appList] = await Promise.all([
    listFeedback({ unreadOnly, appId: unreadOnly ? undefined : appId }),
    listFeedback(),
    db.select({ id: apps.id, name: apps.name }).from(apps).orderBy(apps.name),
  ]);
  const unread = all.filter((r) => !r.readAt).length;
  const items = rows.map((r) => ({
    id: r.id, message: r.message, name: r.name, contact: r.contact, appVersion: r.appVersion, source: r.source,
    createdAt: r.createdAt.getTime(), read: !!r.readAt,
    app: { id: r.appId, name: r.appName, iconUrl: r.appIconUrl, accent: r.accentColor },
  }));
  return (
    <FeedbackInbox
      items={items} unread={unread} total={all.length} apps={appList}
      filter={unreadOnly ? "unread" : "all"} appId={unreadOnly ? undefined : appId} now={Date.now()}
    />
  );
}
