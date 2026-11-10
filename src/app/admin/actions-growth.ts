"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, dbReady } from "@/db";
import { apps, feedback } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { createInvite, revokeInvite } from "@/lib/beta";
import { env } from "@/lib/env";
import { pushEnabled, sendToTopics, type Topic } from "@/lib/push";

export type GrowthState = { ok?: boolean; error?: string; message?: string; link?: string };

/* ─── Feedback inbox ────────────────────────────────────────────────────── */

export async function setFeedbackRead(id: number, read: boolean) {
  await requireAdmin();
  await db.update(feedback).set({ readAt: read ? new Date() : null }).where(eq(feedback.id, Number(id)));
  revalidatePath("/admin", "layout");
}

export async function markAllFeedbackRead() {
  await requireAdmin();
  await dbReady();
  const { isNull } = await import("drizzle-orm");
  await db.update(feedback).set({ readAt: new Date() }).where(isNull(feedback.readAt));
  revalidatePath("/admin", "layout");
}

export async function deleteFeedback(id: number) {
  await requireAdmin();
  await db.delete(feedback).where(eq(feedback.id, Number(id)));
  revalidatePath("/admin", "layout");
}

/* ─── Beta invites ──────────────────────────────────────────────────────── */

/** Creates an invite and returns its link. The token is shown only once (only its hash is stored). */
export async function createBetaInvite(_: GrowthState, form: FormData): Promise<GrowthState> {
  await requireAdmin();
  const label = String(form.get("label") ?? "").trim();
  if (!label) return { error: "Give the invite a label, e.g. who it's for" };
  if (label.length > 80) return { error: "Label is too long" };
  const { token } = await createInvite(label);
  revalidatePath("/admin/beta");
  return { ok: true, message: "Invite created. Copy the link now: it won't be shown again.", link: `${env.siteUrl}/beta/${token}` };
}

export async function revokeBetaInvite(id: number) {
  await requireAdmin();
  await revokeInvite(Number(id));
  revalidatePath("/admin/beta");
}

/* ─── Notifications ─────────────────────────────────────────────────────── */

/** Manual announcement (e.g. a web app update). appId → that app's subscribers + "all"; none → "all". */
export async function broadcastNotification(_: GrowthState, form: FormData): Promise<GrowthState> {
  await requireAdmin();
  if (!pushEnabled()) return { error: "Push isn't configured (VAPID keys missing)" };
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const appId = Number(form.get("appId") ?? 0);
  if (!title || title.length > 80) return { error: "Title is required (max 80 characters)" };
  if (body.length > 200) return { error: "Message is too long (max 200 characters)" };
  let url = "/";
  const topics: Topic[] = ["all"];
  let icon: string | undefined;
  if (appId) {
    await dbReady();
    const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
    if (!app || app.visibility === "draft") return { error: "Pick a public or unlisted app" };
    topics.push(`app:${app.id}`);
    url = `/apps/${app.slug}`;
    icon = app.iconMediaId ? `/media/${app.iconMediaId}` : undefined;
  }
  const r = await sendToTopics(topics, { title, body, url, icon, tag: `broadcast-${Date.now()}` });
  return { ok: true, message: `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}` };
}
