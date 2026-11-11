"use client";

import { useSyncExternalStore } from "react";
import { cancelDownload, dismissDownload, getTray, saveDownload, subscribeDownloads, type TrayItem } from "@/lib/client-downloads";

const none: TrayItem[] = [];
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

/** Play Store–style download status that floats above the tab bar, wherever you are in the store. */
export function DownloadTray() {
  const items = useSyncExternalStore(subscribeDownloads, getTray, () => none);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((d) => {
        const pct = d.total > 0 ? Math.min(100, (d.loaded / d.total) * 100) : null;
        return (
          <div key={d.key} role="status" className="material pointer-events-auto w-full max-w-md rounded-2xl p-3 shadow-card ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead font-semibold text-label">{d.name}</p>
                <p className="text-caption text-label-2 tabular-nums">
                  {d.status === "downloading" && (d.total > 0 ? `${mb(d.loaded)} of ${mb(d.total)} · ${Math.round(pct!)}%` : `${mb(d.loaded)} downloaded`)}
                  {d.status === "ready" && `Downloaded · ${mb(d.total)}`}
                  {d.status === "error" && "Download failed"}
                </p>
              </div>
              {d.status === "downloading" && (
                <button type="button" onClick={() => cancelDownload(d.key)} className="btn-get">CANCEL</button>
              )}
              {d.status === "ready" && (
                <>
                  <button type="button" onClick={() => dismissDownload(d.key)} className="pressable px-2 text-footnote text-label-2">Dismiss</button>
                  <button type="button" onClick={() => saveDownload(d.key)} className="btn-get">INSTALL</button>
                </>
              )}
              {d.status === "error" && (
                <button type="button" onClick={() => dismissDownload(d.key)} className="btn-get">OK</button>
              )}
            </div>
            {d.status === "downloading" && (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill">
                <div
                  className={`h-full rounded-full bg-tint transition-[width] duration-200 ${pct === null ? "w-1/3 animate-pulse" : ""}`}
                  style={pct === null ? undefined : { width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
