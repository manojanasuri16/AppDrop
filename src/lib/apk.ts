import type { GhAsset } from "./github";

export function isApk(a: Pick<GhAsset, "name">) {
  return /\.apk$/i.test(a.name);
}

function matcher(pattern: string): (name: string) => boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return () => true;
  if (p.includes("*") || p.includes("?")) {
    const re = new RegExp(
      "^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      "i",
    );
    return (n) => re.test(n);
  }
  return (n) => n.toLowerCase().includes(p);
}

/** Pick APKs from a release, honoring the app's pattern. Returns them with the primary one first. */
export function selectApks<T extends Pick<GhAsset, "name" | "size">>(assets: T[], pattern: string): T[] {
  const apks = assets.filter(isApk);
  if (!apks.length) return [];
  const m = matcher(pattern);
  const matched = apks.filter((a) => m(a.name));
  const pool = matched.length ? matched : apks;
  const score = (a: T) => {
    const n = a.name.toLowerCase();
    let s = 0;
    if (matched.length && m(a.name)) s += 100;
    if (n.includes("universal")) s += 50;
    if (n.includes("release")) s += 10;
    if (n.includes("debug")) s -= 40;
    if (/(arm64|armeabi|x86)/.test(n)) s -= 5;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a) || b.size - a.size);
}
