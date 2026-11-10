"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setFeatured, setVisibility } from "@/app/admin/actions";
import { SegmentedControl } from "./SegmentedControl";
import { StarIcon, ChevronRight, GlobeIcon, PhoneIcon } from "./icons";
import { useToast } from "./Toast";

export type AdminRow = {
  id: number; name: string; kind: "android" | "web"; iconUrl: string | null; accentColor: string;
  version: string | null; downloads: number; visibility: "public" | "unlisted" | "draft"; featured: boolean;
  sync: { state: "ok" | "error" | "none"; label: string; error?: string };
};
type Patch = { id: number; visibility?: AdminRow["visibility"]; featured?: boolean };

export function AppList({ rows }: { rows: AdminRow[] }) {
  const [opt, apply] = useOptimistic(rows, (cur, p: Patch) =>
    cur.map((r) => (r.id === p.id ? { ...r, visibility: p.visibility ?? r.visibility, featured: p.featured ?? r.featured } : r)),
  );
  const [, start] = useTransition();
  const [toast, show] = useToast();

  const run = (patch: Patch, fn: () => Promise<unknown>) =>
    start(async () => {
      apply(patch);
      try { await fn(); } catch { show("Could not save change", "error"); }
    });

  return (
    <>
      <ul className="group-list" aria-label="Apps">
        {opt.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <Link href={`/admin/apps/${r.id}`} className="pressable group flex min-w-0 flex-1 items-center gap-3.5" aria-label={`Edit ${r.name}`}>
              <div
                className="squircle grid size-14 shrink-0 place-items-center overflow-hidden text-title-3 text-white"
                style={{ background: r.iconUrl ? "var(--fill)" : `linear-gradient(145deg, ${r.accentColor}, color-mix(in srgb, ${r.accentColor} 60%, #000))`, boxShadow: "inset 0 0 0 0.5px var(--separator)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.iconUrl ? <img src={r.iconUrl} alt="" className="size-full object-cover" /> : r.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-headline truncate">{r.name}</span>
                  <span className="text-caption inline-flex shrink-0 items-center gap-1 rounded-full bg-fill px-2 py-0.5 font-medium text-label-2">
                    {r.kind === "android" ? <PhoneIcon width={11} height={11} /> : <GlobeIcon width={11} height={11} />}
                    {r.kind === "android" ? "Android" : "Web"}
                  </span>
                </div>
                <div className="text-footnote mt-0.5 flex flex-wrap items-center gap-x-2 text-label-2">
                  {r.version && <span>{r.version}</span>}
                  <span className="tabular-nums">{r.downloads.toLocaleString("en")} downloads</span>
                  <span className="inline-flex items-center gap-1.5" title={r.sync.error ?? r.sync.label}>
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: r.sync.state === "ok" ? "var(--success)" : r.sync.state === "error" ? "var(--danger)" : "var(--label-3)" }}
                    />
                    <span className={r.sync.state === "error" ? "text-danger" : ""}>
                      {r.sync.state === "error" ? "Sync error" : r.sync.label}
                    </span>
                  </span>
                </div>
              </div>
              <ChevronRight width={18} height={18} className="shrink-0 text-label-3 transition-transform group-hover:translate-x-0.5 sm:hidden" />
            </Link>
            <div className="flex items-center gap-3 sm:w-80">
              <div className="min-w-0 flex-1">
                <SegmentedControl
                  size="sm" label={`Visibility of ${r.name}`} value={r.visibility}
                  onChange={(v) => run({ id: r.id, visibility: v }, () => setVisibility(r.id, v))}
                  options={[{ value: "public", label: "Public" }, { value: "unlisted", label: "Unlisted" }, { value: "draft", label: "Draft" }]}
                />
              </div>
              <button
                type="button" aria-pressed={r.featured} aria-label={r.featured ? `Unfeature ${r.name}` : `Feature ${r.name}`}
                onClick={() => run({ id: r.id, featured: !r.featured }, () => setFeatured(r.id, !r.featured))}
                className={`pressable grid size-11 shrink-0 place-items-center rounded-full ${r.featured ? "text-warning" : "text-label-3 hover:text-label-2"}`}
              >
                <StarIcon filled={r.featured} width={22} height={22} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {toast}
    </>
  );
}
