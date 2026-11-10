export function timeAgo(d: Date | string | number | null | undefined, now = Date.now()): string {
  if (!d) return "never";
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}
export function fmtBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en").format(n);
}
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
