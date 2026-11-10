"use client";

/** Client helpers for Web Push. Everything here degrades to a descriptive state instead of throwing. */

export type PushBlock =
  | "unsupported" // browser has no Push API
  | "ios-install" // iOS Safari tab: push only works for installed web apps
  | "dev" // service worker is only registered in production
  | "denied" // permission blocked in site settings
  | "unconfigured"; // server has no VAPID key

export type PushState = {
  /** False when the notify UI should be hidden entirely (server not configured). */
  available: boolean;
  /** Set when notifications can't currently be turned on, with the reason. */
  blocked: PushBlock | null;
  permission: NotificationPermission | "unsupported";
};

export const BLOCK_MESSAGES: Record<PushBlock, string> = {
  unsupported: "This browser doesn't support notifications.",
  "ios-install": "Add AppDrop to your Home Screen first to get notifications.",
  dev: "Notifications are only available in the production app.",
  denied: "Notifications are blocked. Re-enable them in your browser's site settings, then try again.",
  unconfigured: "Notifications aren't set up yet.",
};

export class PushError extends Error {
  constructor(public reason: PushBlock | "failed", message?: string) {
    super(message ?? (reason === "failed" ? "Something went wrong. Please try again." : BLOCK_MESSAGES[reason]));
  }
}

let keyPromise: Promise<string | null> | undefined;
export function fetchPublicKey(): Promise<string | null> {
  keyPromise ??= fetch("/api/push/key")
    .then((r) => (r.ok ? r.json() : { publicKey: null }))
    .then((j: { publicKey?: string | null }) => j.publicKey ?? null)
    .catch(() => {
      keyPromise = undefined;
      return null;
    });
  return keyPromise;
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supportBlock(): PushBlock | null {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (process.env.NODE_ENV !== "production") return "dev";
  if (Notification.permission === "denied") return "denied";
  return null;
}

export async function getPushState(): Promise<PushState> {
  const key = await fetchPublicKey();
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  if (!key) return { available: false, blocked: "unconfigured", permission };
  return { available: true, blocked: supportBlock(), permission };
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Asks for permission if needed and returns the (possibly pre-existing) push subscription. */
export async function ensureSubscription(): Promise<PushSubscription> {
  const blocked = supportBlock();
  if (blocked) throw new PushError(blocked);
  const publicKey = await fetchPublicKey();
  if (!publicKey) throw new PushError("unconfigured");

  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result === "denied") throw new PushError("denied");
    if (result !== "granted") throw new PushError("failed", "Notifications weren't enabled. Tap the toggle to try again.");
  }
  try {
    const reg = await getRegistration();
    return (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  } catch {
    throw new PushError("failed");
  }
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new PushError("failed");
  return res;
}

export async function subscribeTopic(topic: string): Promise<void> {
  const sub = await ensureSubscription();
  await post("/api/push/subscribe", { subscription: sub.toJSON(), topic });
}

export async function unsubscribeTopic(topic: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await post("/api/push/unsubscribe", { endpoint: sub.endpoint, topic });
}

/** Topics this browser is currently subscribed to ([] when none / unsupported). */
export async function fetchTopics(): Promise<string[]> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return [];
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return [];
    const res = await post("/api/push/status", { endpoint: sub.endpoint });
    const j = (await res.json()) as { topics?: string[] };
    return j.topics ?? [];
  } catch {
    return [];
  }
}
