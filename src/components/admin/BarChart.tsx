"use client";
import { useState } from "react";

export function BarChart({
  data, height = 120, label,
}: { data: { day: string; count: number }[]; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0);
  const peak = data.reduce((a, d) => (d.count > a.count ? d : a), data[0] ?? { day: "", count: 0 });
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  const sel = hover !== null ? data[hover] : null;
  return (
    <figure className="m-0">
      <figcaption className="text-footnote mb-3 flex h-5 items-center justify-between text-label-2" aria-hidden>
        <span>{sel ? `${fmt(sel.day)}` : `${data.length} days`}</span>
        <span className="font-semibold text-label tabular-nums">
          {sel ? `${sel.count} download${sel.count === 1 ? "" : "s"}` : `${total} total`}
        </span>
      </figcaption>
      <div
        role="img"
        aria-label={`${label}: ${total} downloads in the last ${data.length} days${total ? `, peak ${peak.count} on ${fmt(peak.day)}` : ""}.`}
        className="flex items-end gap-[3px]"
        style={{ height }}
        onPointerLeave={() => setHover(null)}
      >
        {data.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full min-w-0 flex-1 items-end"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          >
            <div
              className="w-full rounded-t-[3px] transition-[height,opacity] duration-500 [transition-timing-function:var(--ease-spring)]"
              style={{
                height: `${Math.max(d.count ? 4 : 2, (d.count / max) * 100)}%`,
                background: d.count ? "var(--tint)" : "var(--fill-strong)",
                opacity: hover === null || hover === i ? 1 : 0.4,
              }}
            />
          </div>
        ))}
      </div>
      <div className="text-caption mt-2 flex justify-between text-label-3" aria-hidden>
        <span>{data[0] && fmt(data[0].day)}</span>
        <span>{data.at(-1) && fmt(data.at(-1)!.day)}</span>
      </div>
    </figure>
  );
}
