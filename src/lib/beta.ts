import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { betaInvites } from "@/db/schema";
import { env } from "./env";
import { isAdmin } from "./auth";

/**
 * Beta channel: the owner creates invite links (/beta/<token>). Visiting one stores a signed
 * cookie; while the invite isn't revoked, that browser sees prerelease versions.
 * Only a SHA-256 of each token is stored, so a DB leak doesn't leak working links.
 */
export const BETA_COOKIE = "appdrop_beta";
const TTL_S = 60 * 60 * 24 * 365;
const key = () => new TextEncoder().encode(env.sessionSecret);
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createInvite(label: string): Promise<{ id: number; token: string }> {
  await dbReady();
  const token = randomBytes(18).toString("base64url");
  const [row] = await db
    .insert(betaInvites)
    .values({ tokenHash: hashToken(token), label: label.trim().slice(0, 80) })
    .returning({ id: betaInvites.id });
  return { id: row.id, token };
}

/** Returns the invite id for a valid, unrevoked token (and counts the use), else null. */
export async function redeemToken(token: string, countUse = true): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  await dbReady();
  const inv = await db.query.betaInvites.findFirst({
    where: and(eq(betaInvites.tokenHash, hashToken(token)), isNull(betaInvites.revokedAt)),
  });
  if (!inv) return null;
  if (countUse) {
    await db
      .update(betaInvites)
      .set({ uses: sql`${betaInvites.uses} + 1`, lastUsedAt: new Date() })
      .where(eq(betaInvites.id, inv.id));
  }
  return inv.id;
}

export async function setBetaCookie(inviteId: number) {
  const jwt = await new SignJWT({ inv: inviteId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_S}s`)
    .setAudience("appdrop-beta")
    .sign(key());
  (await cookies()).set(BETA_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_S,
  });
}

export async function clearBetaCookie() {
  (await cookies()).delete(BETA_COOKIE);
}

/** Is this viewer in the beta channel? Admins always are. Revoking an invite takes effect immediately. */
export async function isBetaViewer(): Promise<boolean> {
  if (await isAdmin()) return true;
  const raw = (await cookies()).get(BETA_COOKIE)?.value;
  if (!raw) return false;
  try {
    const { payload } = await jwtVerify(raw, key(), { audience: "appdrop-beta", algorithms: ["HS256"] });
    const id = Number(payload.inv);
    if (!Number.isSafeInteger(id)) return false;
    await dbReady();
    const inv = await db.query.betaInvites.findFirst({ where: and(eq(betaInvites.id, id), isNull(betaInvites.revokedAt)) });
    return !!inv;
  } catch {
    return false;
  }
}

export async function revokeInvite(id: number) {
  await db.update(betaInvites).set({ revokedAt: new Date() }).where(eq(betaInvites.id, id));
}
