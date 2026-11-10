import { requireAdmin } from "@/lib/auth";
import { listInvites } from "@/lib/admin-data";
import { BetaManager } from "@/components/admin/BetaManager";

export const dynamic = "force-dynamic";

export default async function BetaPage() {
  await requireAdmin();
  const invites = await listInvites();
  return (
    <BetaManager
      now={Date.now()}
      invites={invites.map((i) => ({
        id: i.id, label: i.label, uses: i.uses, createdAt: i.createdAt.getTime(),
        lastUsedAt: i.lastUsedAt ? i.lastUsedAt.getTime() : null, revoked: !!i.revokedAt,
      }))}
    />
  );
}
