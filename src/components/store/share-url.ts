/** Append ?via=<source> (or &via=) to a URL, replacing any existing via param. Works for absolute URLs and paths. */
export function withVia(url: string, via: "share" | "qr"): string {
  const hashAt = url.indexOf("#");
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const qAt = base.indexOf("?");
  const path = qAt >= 0 ? base.slice(0, qAt) : base;
  const params = new URLSearchParams(qAt >= 0 ? base.slice(qAt + 1) : "");
  params.set("via", via);
  return `${path}?${params.toString()}${hash}`;
}
