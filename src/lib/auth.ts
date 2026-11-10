import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { loginAttempts } from "@/db/schema";
import { env } from "./env";

export const SESSION_COOKIE = "appdrop_session";
const SESSION_TTL_S = 60 * 60 * 24 * 7;
const MAX_ATTEMPTS = 5;
const WINDOW_S = 15 * 60;

const key = () => new TextEncoder().encode(env.sessionSecret);
const sha = (s: string) => createHash("sha256").update(s).digest();

export function passwordMatches(input: string): boolean {
  // Hash both sides so lengths match and comparison is constant-time.
  return timingSafeEqual(sha(input), sha(env.adminPassword));
}

export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  return createHash("sha256").update(ip + env.sessionSecret).digest("hex").slice(0, 32);
}

/** Returns seconds until the client may retry, or 0 if allowed. */
export async function loginThrottle(k: string): Promise<number> {
  await dbReady();
  const since = new Date(Date.now() - WINDOW_S * 1000);
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, since));
  const rows = await db
    .select({ createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, k), gt(loginAttempts.createdAt, since)))
    .orderBy(loginAttempts.createdAt);
  if (rows.length < MAX_ATTEMPTS) return 0;
  return Math.max(1, Math.ceil((rows[0].createdAt.getTime() + WINDOW_S * 1000 - Date.now()) / 1000));
}

export async function recordFailedLogin(k: string) {
  await db.insert(loginAttempts).values({ key: k });
}
export async function clearFailedLogins(k: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, k));
}

export async function createSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .setAudience("appdrop-admin")
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "appdrop-admin", algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Call at the top of every admin page AND every admin server action (defense in depth beyond proxy.ts). */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
