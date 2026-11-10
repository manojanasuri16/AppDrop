import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { pushSubscriptions, type App } from "@/db/schema";
import { env } from "./env";
import { displayVersion } from "./version";

export type Topic = "all" | "admin" | `app:${number}`;
export type PushPayload = { title: string; body: string; url: string; icon?: string; tag?: string };

/**
 * The server POSTs to whatever endpoint a browser hands us, so only accept the real
 * browser push services (prevents SSRF into internal networks / arbitrary hosts).
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname)) && endpoint.length <= 1000;
  } catch {
    return false;
  }
}

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export function parseSubscription(raw: unknown): SubscriptionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof r.endpoint === "string" ? r.endpoint : "";
  const p256dh = typeof r.keys?.p256dh === "string" ? r.keys.p256dh : "";
  const auth = typeof r.keys?.auth === "string" ? r.keys.auth : "";
  if (!isAllowedEndpoint(endpoint)) return null;
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,64}$/.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export const pushEnabled = () => !!env.vapid;
export const vapidPublicKey = () => env.vapid?.publicKey ?? null;

export async function subscribe(sub: SubscriptionInput, topic: Topic) {
  await dbReady();
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, topic })
    .onConflictDoUpdate({
      target: [pushSubscriptions.endpoint, pushSubscriptions.topic],
      set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function unsubscribe(endpoint: string, topic?: Topic) {
  await dbReady();
  await db
    .delete(pushSubscriptions)
    .where(topic ? and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.topic, topic)) : eq(pushSubscriptions.endpoint, endpoint));
}

/** Topics an endpoint is subscribed to (lets the UI show the current state). */
export async function topicsFor(endpoint: string): Promise<string[]> {
  await dbReady();
  const rows = await db.select({ topic: pushSubscriptions.topic }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return rows.map((r) => r.topic);
}

export async function countByTopic(): Promise<Record<string, number>> {
  await dbReady();
  const rows = await db.select({ topic: pushSubscriptions.topic, endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.topic] = (out[r.topic] ?? 0) + 1;
  out.devices = new Set(rows.filter((r) => r.topic !== "admin").map((r) => r.endpoint)).size;
  return out;
}

/** Send to every device subscribed to any of the topics (each device once). Prunes dead subscriptions. */
export async function sendToTopics(topics: Topic[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const v = env.vapid;
  if (!v || !topics.length) return { sent: 0, failed: 0 };
  await dbReady();
  const rows = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.topic, topics));
  const byEndpoint = new Map(rows.map((r) => [r.endpoint, r]));
  const body = JSON.stringify({ ...payload, title: payload.title.slice(0, 80), body: payload.body.slice(0, 200) });
  let sent = 0, failed = 0;
  const dead: string[] = [];
  await Promise.all(
    [...byEndpoint.values()].map(async (r) => {
      if (!isAllowedEndpoint(r.endpoint)) return void dead.push(r.endpoint);
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, {
          TTL: 60 * 60 * 24,
          urgency: "normal",
          timeout: 10_000,
          vapidDetails: { subject: v.subject, publicKey: v.publicKey, privateKey: v.privateKey },
        });
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(r.endpoint);
        else console.error("[push]", code, (e as Error).message);
      }
    }),
  );
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
  return { sent, failed };
}

export async function notifyNewRelease(app: Pick<App, "id" | "slug" | "name" | "iconMediaId">, tag: string, notes: string) {
  const firstLine = notes.replace(/[#*_`>\[\]]/g, "").split("\n").map((l) => l.trim()).find((l) => l.length > 3) ?? "";
  return sendToTopics(["all", `app:${app.id}`], {
    title: `${app.name} ${displayVersion(tag)} is available`,
    body: firstLine || "Tap to see what's new and update.",
    url: `/apps/${app.slug}`,
    icon: app.iconMediaId ? `/media/${app.iconMediaId}` : "/icons/192",
    tag: `release-${app.slug}`,
  });
}
