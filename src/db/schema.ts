import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, blob, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

/** visibility: public = listed in store; unlisted = reachable by direct link only; draft = admin only */
export const apps = sqliteTable(
  "apps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** android = APKs from GitHub Releases; web = deployed web app opened via webUrl */
    kind: text("kind", { enum: ["android", "web"] }).notNull().default("android"),
    /** https URL of a deployed web app (kind = web) */
    webUrl: text("web_url").notNull().default(""),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""), // markdown
    category: text("category").notNull().default("Utilities"),
    developer: text("developer").notNull().default(""),
    iconMediaId: text("icon_media_id"),
    accentColor: text("accent_color").notNull().default("#0a84ff"),
    packageName: text("package_name").notNull().default(""),
    /** GitHub repo. Required for android apps; optional for web apps (used for changelog/releases). */
    repoOwner: text("repo_owner").notNull().default(""),
    repoName: text("repo_name").notNull().default(""),
    repoPrivate: integer("repo_private", { mode: "boolean" }).notNull().default(false),
    /** optional case-insensitive substring/glob the APK filename must match (e.g. "universal") */
    assetPattern: text("asset_pattern").notNull().default(""),
    includePrereleases: integer("include_prereleases", { mode: "boolean" }).notNull().default(false),
    visibility: text("visibility", { enum: ["public", "unlisted", "draft"] }).notNull().default("draft"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
    syncError: text("sync_error"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("apps_slug_uq").on(t.slug), index("apps_visibility_idx").on(t.visibility)],
);

export const media = sqliteTable("media", {
  id: text("id").primaryKey(), // random, unguessable
  mime: text("mime").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const screenshots = sqliteTable(
  "screenshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    mediaId: text("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("screenshots_app_idx").on(t.appId)],
);

/** Mirrors GitHub releases that contain at least one APK. id = GitHub release id. */
export const releases = sqliteTable(
  "releases",
  {
    id: integer("id").primaryKey(),
    appId: integer("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    name: text("name").notNull().default(""),
    body: text("body").notNull().default(""), // markdown changelog
    prerelease: integer("prerelease", { mode: "boolean" }).notNull().default(false),
    publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
    htmlUrl: text("html_url").notNull().default(""),
  },
  (t) => [index("releases_app_pub_idx").on(t.appId, t.publishedAt)],
);

/** APK assets of a release. id = GitHub asset id. */
export const assets = sqliteTable(
  "assets",
  {
    id: integer("id").primaryKey(),
    releaseId: integer("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
    appId: integer("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    digest: text("digest"), // "sha256:..." when GitHub provides it
    browserDownloadUrl: text("browser_download_url").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("assets_release_idx").on(t.releaseId)],
);

export const downloads = sqliteTable(
  "downloads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    releaseId: integer("release_id"),
    assetId: integer("asset_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("downloads_app_idx").on(t.appId, t.createdAt), index("downloads_release_idx").on(t.releaseId)],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(), // hashed client ip
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

/** Small key/value store for auth bookkeeping (e.g. last accepted TOTP step for replay protection). */
export const authState = sqliteTable("auth_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** "all" | "app:<id>" | "admin" */
    topic: text("topic").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("push_sub_uq").on(t.endpoint, t.topic), index("push_sub_topic_idx").on(t.topic)],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    name: text("name").notNull().default(""),
    contact: text("contact").notNull().default(""),
    appVersion: text("app_version").notNull().default(""),
    /** "web" (store form) | "app" (in-app via API) */
    source: text("source").notNull().default("web"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
    readAt: integer("read_at", { mode: "timestamp" }),
  },
  (t) => [index("feedback_app_idx").on(t.appId, t.createdAt), index("feedback_unread_idx").on(t.readAt)],
);

export const betaInvites = sqliteTable(
  "beta_invites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    label: text("label").notNull().default(""),
    uses: integer("uses").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("beta_invites_hash_uq").on(t.tokenHash)],
);

export const versionPings = sqliteTable(
  "version_pings",
  {
    appId: integer("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    device: text("device").notNull(),
    version: text("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.appId, t.day, t.device] })],
);

export const pageViews = sqliteTable(
  "page_views",
  {
    appId: integer("app_id").notNull(),
    day: text("day").notNull(),
    source: text("source").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.appId, t.day, t.source] })],
);

export type App = typeof apps.$inferSelect;
export type Release = typeof releases.$inferSelect;
export type Asset = typeof assets.$inferSelect;
