"use client";

import { useSyncExternalStore } from "react";
import { getDownload, subscribeDownloads } from "@/lib/client-downloads";

const idle = { status: "idle", loaded: 0, total: 0 } as const;
const mb = (n: number) => `${(n / 1e6).toFixed(1)}`;

/** Replaces a row's caption with live download progress for that app; renders children otherwise. */
export function DownloadLine({ href, enabled = true, children }: { href: string; enabled?: boolean; children: React.ReactNode }) {
  const st = useSyncExternalStore(subscribeDownloads, () => (enabled ? getDownload(href) : idle), () => idle);
  if (st.status === "idle") return <>{children}</>;
  const pct = st.total > 0 ? Math.min(100, (st.loaded / st.total) * 100) : null;
  return (
    <div role="status" className="mt-0.5">
      {st.status === "downloading" && (
        <>
          <p className="truncate text-caption text-label-2 tabular-nums">
            {st.total > 0 ? `${mb(st.loaded)} MB of ${mb(st.total)} MB` : `${mb(st.loaded)} MB downloaded`}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-fill">
            <div className={`h-full rounded-full bg-tint ${pct === null ? "w-1/3 animate-pulse" : ""}`} style={pct === null ? undefined : { width: `${pct}%` }} />
          </div>
        </>
      )}
      {st.status === "ready" && <p className="truncate text-caption text-label-2">Downloaded — tap Save</p>}
      {st.status === "saved" && <p className="text-caption text-label-2">Saved — tap Install, then Open in the notification</p>}
      {st.status === "error" && <p className="truncate text-caption text-destructive">Download failed</p>}
    </div>
  );
}
