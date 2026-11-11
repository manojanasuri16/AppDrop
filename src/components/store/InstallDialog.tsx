"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { closeInstallHelp, getInstallHelp, openDownloadsApp, subscribeDownloads } from "@/lib/client-downloads";

/** Tells the user where the saved APK is and how to install it from the phone. */
export function InstallDialog() {
  const help = useSyncExternalStore(subscribeDownloads, getInstallHelp, () => null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [help]);
  // If the page is still in front shortly after tapping, Android/Chrome didn't open Downloads.
  const tryOpen = () => {
    let left = false;
    const onHide = () => { left = true; };
    document.addEventListener("visibilitychange", onHide, { once: true });
    window.addEventListener("pagehide", onHide, { once: true });
    openDownloadsApp();
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      if (!left && !document.hidden) setFailed(true);
    }, 1500);
  };
  useEffect(() => {
    if (!help) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeInstallHelp();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help]);
  if (!help) return null;
  const android = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={closeInstallHelp}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-sm rounded-3xl bg-elevated p-6 shadow-card ring-1 ring-black/5 dark:ring-white/10"
      >
        <h2 id="saved-title" className="text-title-3 text-label">{help.name} is saved</h2>
        <p className="mt-2 text-callout text-label-2">
          The app is already downloaded and saved in your phone&apos;s <strong className="font-semibold text-label">Downloads</strong>. Install it from there:
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-callout text-label-2">
          {android ? (
            <li>Tap the <strong className="font-semibold text-label">Download complete</strong> notification, or open this browser&apos;s menu (<strong className="font-semibold text-label">⋮</strong>) and choose <strong className="font-semibold text-label">Downloads</strong>.</li>
          ) : (
            <li>Open your phone&apos;s <strong className="font-semibold text-label">Downloads</strong> (or tap the download notification).</li>
          )}
          <li>Tap <strong className="font-semibold text-label">{help.filename}</strong>.</li>
          <li>Tap <strong className="font-semibold text-label">Install</strong>. If asked, allow installs from this browser.</li>
        </ol>
        {failed && (
          <p role="status" className="mt-3 rounded-xl bg-warning/15 px-3 py-2 text-footnote text-label">
            Couldn&apos;t open Downloads from here. Use the notification or the browser menu (⋮) → Downloads.
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={closeInstallHelp} className="btn-secondary flex-1">Close</button>
          {android && (
            <button type="button" onClick={tryOpen} className="btn-primary flex-1">Open Downloads</button>
          )}
        </div>
      </div>
    </div>
  );
}
