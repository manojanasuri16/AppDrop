"use client";

/**
 * In-app APK downloader. Streams the file with fetch so the UI can show real progress, keeps the
 * Blob in memory (shared across every button for the same app), and only hands it to the browser's
 * installer flow when the user taps Install.
 */
export type DownloadState = { status: "idle" | "downloading" | "ready" | "saved" | "error"; loaded: number; total: number };
type Entry = DownloadState & { blob?: Blob; filename: string; name?: string; ctrl?: AbortController };

const entries = new Map<string, Entry>();
const snapshots = new Map<string, DownloadState>();
const listeners = new Set<() => void>();
let help: { name: string; filename: string } | null = null;
const idle: DownloadState = { status: "idle", loaded: 0, total: 0 };

function set(key: string, patch: Partial<Entry>) {
  const next = { ...(entries.get(key) ?? { ...idle, filename: "app.apk" }), ...patch };
  entries.set(key, next);
  // New object identity per change so useSyncExternalStore sees an update; stable otherwise.
  snapshots.set(key, { status: next.status, loaded: next.loaded, total: next.total });
  listeners.forEach((l) => l());
}


export function subscribeDownloads(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export function getDownload(key: string): DownloadState {
  return snapshots.get(key) ?? idle;
}

export async function startDownload(key: string, href: string, name?: string, expectedSize?: number | null) {
  if (getDownload(key).status === "downloading") return;
  if (typeof fetch === "undefined") {
    window.location.href = href;
    return;
  }
  const ctrl = new AbortController();
  set(key, { status: "downloading", loaded: 0, total: expectedSize || 0, blob: undefined, ctrl, name });
  try {
    const url = href + (href.includes("?") ? "&" : "?") + "stream=1";
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(String(res.status));
    const total = Number(res.headers.get("content-length")) || expectedSize || 0;
    const m = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "");
    set(key, { total, filename: m?.[1] ?? "app.apk" });
    const reader = res.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let loaded = 0;
    let last = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as Uint8Array<ArrayBuffer>);
      loaded += value.length;
      const now = performance.now();
      if (now - last > 100) {
        last = now;
        set(key, { loaded });
      }
    }
    const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
    set(key, { status: "ready", loaded: blob.size, total: blob.size, blob, ctrl: undefined });
  } catch (e) {
    if (ctrl.signal.aborted) set(key, { ...idle, ctrl: undefined });
    else set(key, { status: "error", loaded: 0, total: 0, ctrl: undefined });
  }
}

export function cancelDownload(key: string) {
  entries.get(key)?.ctrl?.abort();
}

/** Hands the finished file to the browser so Android's normal package installer takes over. */
export function saveDownload(key: string) {
  const e = entries.get(key);
  if (!e?.blob) return;
  const url = URL.createObjectURL(e.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = e.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  set(key, { status: "saved" });
}

export function getInstallHelp() {
  return help;
}

/** Shows the "already saved, install it from your phone" dialog. */
export function showInstallHelp(key: string) {
  const e = entries.get(key);
  help = { name: e?.name ?? "This app", filename: e?.filename ?? "the APK" };
  listeners.forEach((l) => l());
}

export function closeInstallHelp() {
  help = null;
  listeners.forEach((l) => l());
}
