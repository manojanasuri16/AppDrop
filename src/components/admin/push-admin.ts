"use client";

/** Small helper for "admin alerts on this device" (push topic "admin"). */
function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function registration() {
  // The service worker is only registered in production.
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 4000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function adminAlertsEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  const r = await post("/api/push/status", { endpoint: sub.endpoint });
  if (!r.ok) return false;
  const j = (await r.json()) as { topics?: string[] };
  return !!j.topics?.includes("admin");
}

export async function enableAdminAlerts(): Promise<void> {
  if (!pushSupported()) throw new Error("This browser doesn't support push notifications");
  const reg = await registration();
  if (!reg) throw new Error("Service worker isn't active (it only runs in production builds)");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notification permission was denied");
  const k = await fetch("/api/push/key");
  const { publicKey } = (await k.json()) as { publicKey: string | null };
  if (!publicKey) throw new Error("Push isn't configured on the server");
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) as BufferSource }));
  const r = await post("/api/push/subscribe", { subscription: sub.toJSON(), topic: "admin" });
  if (!r.ok) throw new Error("Couldn't subscribe this device");
}

export async function disableAdminAlerts(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await post("/api/push/unsubscribe", { endpoint: sub.endpoint, topic: "admin" });
}
