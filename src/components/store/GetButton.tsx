"use client";

import { useSyncExternalStore } from "react";
import type { AppCard } from "@/lib/queries";
import { cancelDownload, getDownload, saveDownload, startDownload, subscribeDownloads } from "@/lib/client-downloads";

type Props = {
  app: Pick<AppCard, "kind" | "name"> & { latestSize?: number | null };
  /** Download / open URL (links.get). */
  href: string;
  size?: "sm" | "lg";
  disabled?: boolean;
  className?: string;
};

const idle = { status: "idle", loaded: 0, total: 0 } as const;

export function GetButton({ app, href, size = "sm", disabled, className = "" }: Props) {
  const web = app.kind === "web";
  const cls = size === "lg" ? "btn-primary min-w-28" : "btn-get";
  const key = href;
  const st = useSyncExternalStore(
    subscribeDownloads,
    () => (web ? idle : getDownload(key)),
    () => idle,
  );
  const text = (s: string) => (size === "sm" ? s.toUpperCase() : s);

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${cls} pointer-events-none opacity-40 ${className}`}>
        {text(web ? "Open" : "Get")}
      </span>
    );
  }

  if (web) {
    return (
      <a href={href} aria-label={`Open ${app.name}`} target="_blank" rel="noopener noreferrer" className={`${cls} ${className}`}>
        {text("Open")}
      </a>
    );
  }

  if (st.status === "downloading") {
    const pct = st.total > 0 ? Math.min(100, Math.round((st.loaded / st.total) * 100)) : null;
    return (
      <button
        type="button"
        onClick={() => cancelDownload(key)}
        aria-label={`Cancel download of ${app.name}${pct !== null ? `, ${pct}% done` : ""}`}
        className={`${size === "lg" ? "btn-secondary min-w-28 gap-2.5" : "btn-get min-w-[5.5rem] gap-1.5"} ${className}`}
      >
        <Ring pct={pct} />
        <span className="tabular-nums">{pct !== null ? `${pct}%` : "…"}</span>
        {size === "lg" && st.total > 0 && <span className="text-footnote font-normal text-label-2 tabular-nums">{mb(st.loaded)} / {mb(st.total)}</span>}
      </button>
    );
  }

  if (st.status === "ready" || st.status === "saved") {
    const saved = st.status === "saved";
    return (
      <button type="button" onClick={() => saveDownload(key)} aria-label={`${saved ? "Install" : "Save"} ${app.name}`} className={`${size === "lg" ? "btn-primary" : "btn-get"} ${saved ? "" : "min-w-[4.5rem]"} ${className}`}>
        {text(saved ? "Install" : "Save")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => startDownload(key, href, app.name, app.latestSize)}
      aria-label={`${st.status === "error" ? "Retry download of" : "Get"} ${app.name}`}
      className={`${cls} ${className}`}
    >
      {text(st.status === "error" ? "Retry" : "Get")}
    </button>
  );
}

function mb(n: number) {
  return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
}

/** Circular progress with a stop square, like the App Store. */
function Ring({ pct }: { pct: number | null }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className={pct === null ? "animate-spin" : ""}>
      <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <circle
        cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - (pct ?? 25) / 100)} transform="rotate(-90 11 11)"
        style={{ transition: "stroke-dashoffset 0.2s linear" }}
      />
      <rect x="8" y="8" width="6" height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}
