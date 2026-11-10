import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "file:./data/appdrop.db";
  },
  get databaseAuthToken() {
    return process.env.DATABASE_AUTH_TOKEN || undefined;
  },
  /** Fine-grained PAT (Contents: read-only, Metadata: read-only) — server only. Optional if all repos are public. */
  get githubToken() {
    return process.env.GITHUB_TOKEN || undefined;
  },
  get githubWebhookSecret() {
    return process.env.GITHUB_WEBHOOK_SECRET || undefined;
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  /** Base32 authenticator secret (npm run totp:setup). Required: admin login always needs a code. */
  get adminTotpSecret() {
    return process.env.ADMIN_TOTP_SECRET?.replace(/\s/g, "") || undefined;
  },
  /** Bearer key for the publishing API (/api/v1). API is disabled unless set (≥ 32 chars). */
  get apiKey() {
    const k = process.env.APPDROP_API_KEY;
    return k && k.length >= 32 ? k : undefined;
  },
  /** Web Push VAPID keys (npx web-push generate-vapid-keys). Push is disabled unless both are set. */
  get vapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return undefined;
    return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:admin@example.com" };
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  /** Bearer token for GET /api/backup (scheduled backups). Disabled unless set (≥ 32 chars). */
  get backupToken() {
    const t = process.env.BACKUP_TOKEN;
    return t && t.length >= 32 ? t : undefined;
  },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return s;
  },
  get siteName() {
    return process.env.NEXT_PUBLIC_SITE_NAME || "AppDrop";
  },
  /** Minutes before a release list is considered stale and refreshed in the background. */
  get syncTtlMinutes() {
    return Number(process.env.SYNC_TTL_MINUTES ?? 15);
  },
};
