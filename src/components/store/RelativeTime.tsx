import { formatDate, relativeTime } from "./format";

export function RelativeTime({ date, className }: { date: Date | string | null | undefined; className?: string }) {
  if (!date) return <span className={className}>—</span>;
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} title={formatDate(d)} className={className}>
      {relativeTime(d)}
    </time>
  );
}
