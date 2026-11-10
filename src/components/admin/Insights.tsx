import Link from "next/link";
import { BarChart } from "./BarChart";
import { Section } from "./Field";
import { fmtNum } from "./format";
import type { AppStats } from "@/lib/stats";

const SOURCES = [
  { key: "direct", label: "Direct", color: "var(--tint)" },
  { key: "share", label: "Shared links", color: "var(--success)" },
  { key: "qr", label: "QR", color: "var(--warning)" },
  { key: "app", label: "From app", color: "var(--label-tertiary)" },
] as const;

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 1000) / 10}%`);
const card = { boxShadow: "var(--shadow-card)" };

export function Insights({ stats, appId, appName, android }: { stats: AppStats; appId: number; appName: string; android: boolean }) {
  const { views, downloads30d, conversion, activeDevices, feedback } = stats;
  // Newest version always shown; older ones only if they were actually downloaded. Max 8 rows.
  const downloadsByVersion = stats.downloadsByVersion.filter((v, i) => i === 0 || v.count > 0).slice(0, 8);
  const tiles = [
    { label: "Views", value: fmtNum(views.total) },
    { label: "Downloads", value: fmtNum(downloads30d) },
    { label: "Conversion", value: pct(conversion) },
    ...(android ? [
      { label: "Active devices", value: fmtNum(activeDevices.total) },
      { label: "On latest", value: pct(activeDevices.onLatest) },
    ] : []),
  ];
  const maxDl = Math.max(1, ...downloadsByVersion.map((v) => v.count));
  const maxDev = Math.max(1, ...activeDevices.byVersion.map((v) => v.devices));
  return (
    <Section title="Insights (30 days)">
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl bg-elevated p-4" style={card}>
              <dt className="text-footnote text-label-2">{t.label}</dt>
              <dd className="text-title-2 mt-1 tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-2xl bg-elevated p-5" style={card}>
          <h3 className="text-headline mb-4">Page views</h3>
          <BarChart data={views.series} unit="view" label={`Daily views for ${appName}`} />
        </div>

        <div className="rounded-2xl bg-elevated p-5" style={card}>
          <h3 className="text-headline mb-4">Views by source</h3>
          {views.total === 0 ? (
            <p className="text-subhead text-label-2">No views yet.</p>
          ) : (
            <>
              <div role="img" aria-label={SOURCES.map((s) => `${s.label} ${views.bySource[s.key]}`).join(", ")} className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-fill">
                {SOURCES.map((s) => views.bySource[s.key] > 0 && (
                  <div key={s.key} style={{ width: `${(views.bySource[s.key] / views.total) * 100}%`, background: s.color }} />
                ))}
              </div>
              <ul className="text-footnote mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {SOURCES.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="text-label-2">{s.label}</span>
                    <span className="ml-auto font-semibold tabular-nums">{fmtNum(views.bySource[s.key])}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {downloadsByVersion.length > 0 && (
          <div className="rounded-2xl bg-elevated p-5" style={card}>
            <h3 className="text-headline mb-4">Downloads by version</h3>
            <ul className="flex flex-col gap-2.5">
              {downloadsByVersion.map((v) => (
                <li key={v.tag} className="text-footnote grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{v.tag}</span>
                    {v.prerelease && <span className="text-caption shrink-0 rounded-full bg-warning/20 px-1.5 font-semibold">Beta</span>}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-fill"><span className="block h-full rounded-full bg-tint" style={{ width: `${(v.count / maxDl) * 100}%` }} /></span>
                  <span className="min-w-8 text-right tabular-nums">{fmtNum(v.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {android && activeDevices.byVersion.length > 0 && (
          <div className="rounded-2xl bg-elevated p-5" style={card}>
            <h3 className="text-headline">Active devices by version</h3>
            <p className="text-footnote mt-1 mb-4 text-label-2">Counted from in-app update checks over the last 30 days.</p>
            <ul className="flex flex-col gap-2.5">
              {activeDevices.byVersion.map((v) => (
                <li key={v.version} className="text-footnote grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
                  <span className="truncate font-medium">{v.version}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-fill"><span className="block h-full rounded-full bg-success" style={{ width: `${(v.devices / maxDev) * 100}%` }} /></span>
                  <span className="min-w-8 text-right tabular-nums">{fmtNum(v.devices)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href={`/admin/feedback?app=${appId}`} className="group-list pressable text-callout flex min-h-12 items-center justify-between px-4 py-3">
          <span>Feedback for this app <span className="text-label-2">· {feedback.total} total{feedback.unread ? `, ${feedback.unread} unread` : ""}</span></span>
          <span className="text-tint">View</span>
        </Link>
      </div>
    </Section>
  );
}
