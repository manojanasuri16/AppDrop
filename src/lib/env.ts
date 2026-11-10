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
