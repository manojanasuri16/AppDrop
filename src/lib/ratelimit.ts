import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { db, dbReady } from "@/db";
import { loginAttempts } from "@/db/schema";
import { env } from "./env";

/** Stable, non-reversible per-client key (IP + server secret), namespaced by purpose. */
export function clientHash(ip: string, ns: string) {
  return ns + ":" + createHash("sha256").update(ip + "|" + env.sessionSecret).digest("hex").slice(0, 32);
}

export function ipFrom(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function requestKey(ns: string, req?: Request) {
  return clientHash(ipFrom(req ? req.headers : await headers()), ns);
}

/**
 * Sliding-window limiter backed by the login_attempts table (works across serverless instances).
 * Returns true when the call is allowed (and records it), false when over the limit.
 */
export async function rateLimit(key: string, max: number, windowS: number): Promise<boolean> {
  await dbReady();
  const since = new Date(Date.now() - windowS * 1000);
  await db.delete(loginAttempts).where(and(eq(loginAttempts.key, key), lt(loginAttempts.createdAt, since)));
  const recent = await db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, since)))
    .limit(max);
  if (recent.length >= max) return false;
  await db.insert(loginAttempts).values({ key });
  return true;
}
