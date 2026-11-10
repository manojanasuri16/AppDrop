import "server-only";
import { env } from "./env";

/**
 * Minimal GitHub REST client. The token never leaves the server: it is only
 * attached to requests to api.github.com, and download redirects hand the
 * browser GitHub's short-lived signed URL (which contains no token).
 */
const API = "https://api.github.com";
const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function assertRepo(owner: string, repo: string) {
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo) || owner.startsWith(".") || repo === "." || repo === "..") {
    throw new GitHubError("Invalid repository name", 400);
  }
}

function headers(accept = "application/vnd.github+json"): HeadersInit {
  const h: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AppDrop",
  };
  if (env.githubToken) h.Authorization = `Bearer ${env.githubToken}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    let msg = `GitHub ${res.status}`;
    if (res.status === 404) msg = "Repository not found or token lacks access";
    else if (res.status === 401) msg = "GitHub token is invalid or expired";
    else if (res.status === 403 || res.status === 429) msg = "GitHub rate limit or permission error";
    throw new GitHubError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export type GhAsset = {
  id: number;
  name: string;
  size: number;
  state: string;
  content_type: string;
  digest?: string | null;
  browser_download_url: string;
};
export type GhRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  created_at: string;
  html_url: string;
  assets: GhAsset[];
};
export type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics?: string[];
  pushed_at: string;
};

export async function getRepo(owner: string, repo: string) {
  assertRepo(owner, repo);
  return gh<GhRepo>(`/repos/${owner}/${repo}`);
}

/** All releases (paginated, capped at 300). Drafts are excluded. */
export async function listReleases(owner: string, repo: string): Promise<GhRelease[]> {
  assertRepo(owner, repo);
  const out: GhRelease[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh<GhRelease[]>(`/repos/${owner}/${repo}/releases?per_page=100&page=${page}`);
    out.push(...batch.filter((r) => !r.draft));
    if (batch.length < 100) break;
  }
  return out;
}

/** Repositories the configured token can see — powers the admin repo picker. */
export async function listAccessibleRepos(): Promise<GhRepo[]> {
  if (!env.githubToken) return [];
  const out: GhRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh<GhRepo[]>(`/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** Fetch a file from the repo's default branch (used for fastlane metadata import). */
export async function getRepoFile(owner: string, repo: string, path: string): Promise<Buffer | null> {
  assertRepo(owner, repo);
  const safe = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${safe}`, {
    headers: headers("application/vnd.github.raw+json"),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(`GitHub ${res.status}`, res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 5 * 1024 * 1024 ? null : buf;
}

export async function listRepoDir(owner: string, repo: string, path: string): Promise<{ name: string; path: string; type: string }[]> {
  assertRepo(owner, repo);
  const safe = path.split("/").map(encodeURIComponent).join("/");
  try {
    const r = await gh<unknown>(`/repos/${owner}/${repo}/contents/${safe}`);
    return Array.isArray(r) ? (r as { name: string; path: string; type: string }[]) : [];
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

/**
 * Resolve a temporary download for a release asset.
 * GitHub answers 302 → signed URL (preferred: we redirect the browser there, no bandwidth on our side),
 * or 200 with the body (we stream it through).
 */
export async function resolveAssetDownload(
  owner: string,
  repo: string,
  assetId: number,
): Promise<{ type: "redirect"; url: string } | { type: "stream"; res: Response }> {
  assertRepo(owner, repo);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) throw new GitHubError("Invalid asset", 400);
  const res = await fetch(`${API}/repos/${owner}/${repo}/releases/assets/${assetId}`, {
    headers: headers("application/octet-stream"),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new GitHubError("GitHub returned a redirect without location", 502);
    const u = new URL(loc);
    // Only ever redirect users to GitHub-controlled hosts.
    if (u.protocol !== "https:" || !/(^|\.)(githubusercontent\.com|github\.com|githubassets\.com)$/.test(u.hostname)) {
      throw new GitHubError("Unexpected download host", 502);
    }
    return { type: "redirect", url: u.toString() };
  }
  if (res.ok && res.body) return { type: "stream", res };
  throw new GitHubError(`GitHub ${res.status}`, res.status === 404 ? 404 : 502);
}
