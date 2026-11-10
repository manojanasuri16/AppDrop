import { requireAdmin } from "@/lib/auth";
import { db, dbReady } from "@/db";
import { apps } from "@/db/schema";
import { pushOverview } from "@/lib/admin-data";
import { NotificationsManager } from "@/components/admin/NotificationsManager";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAdmin();
  await dbReady();
  const [push, appList] = await Promise.all([
    pushOverview(),
    db.select({ id: apps.id, name: apps.name, visibility: apps.visibility }).from(apps).orderBy(apps.name),
  ]);
  const c = push.counts as Record<string, number>;
  return (
    <NotificationsManager
      enabled={push.enabled}
      devices={c.devices ?? 0}
      all={c.all ?? 0}
      admin={c.admin ?? 0}
      apps={appList.map((a) => ({ id: a.id, name: a.name, subscribers: c[`app:${a.id}`] ?? 0, sendable: a.visibility !== "draft" }))}
    />
  );
}
