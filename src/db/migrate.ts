import type { Client } from "@libsql/client";

/**
 * Tiny forward-only migrator. Each entry runs once, tracked in _migrations.
 * Keep in sync with schema.ts. Never edit an applied migration — append a new one.
 * Every statement MUST be idempotent (IF NOT EXISTS etc.): concurrent cold starts
 * (build workers, serverless instances) may run the same migration at the same time.
 */
const MIGRATIONS: { id: number; sql: string[] }[] = [
  {
    id: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'android',
        web_url TEXT NOT NULL DEFAULT '',
        tagline TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Utilities',
        developer TEXT NOT NULL DEFAULT '',
        icon_media_id TEXT,
        accent_color TEXT NOT NULL DEFAULT '#0a84ff',
        package_name TEXT NOT NULL DEFAULT '',
        repo_owner TEXT NOT NULL DEFAULT '',
        repo_name TEXT NOT NULL DEFAULT '',
        repo_private INTEGER NOT NULL DEFAULT 0,
        asset_pattern TEXT NOT NULL DEFAULT '',
        include_prereleases INTEGER NOT NULL DEFAULT 0,
        visibility TEXT NOT NULL DEFAULT 'draft',
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        last_synced_at INTEGER,
        sync_error TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS apps_slug_uq ON apps(slug)`,
      `CREATE INDEX IF NOT EXISTS apps_visibility_idx ON apps(visibility)`,
      `CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        data BLOB NOT NULL,
        width INTEGER,
        height INTEGER,
        bytes INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS screenshots_app_idx ON screenshots(app_id)`,
      `CREATE TABLE IF NOT EXISTS releases (
        id INTEGER PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        prerelease INTEGER NOT NULL DEFAULT 0,
        published_at INTEGER NOT NULL,
        html_url TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE INDEX IF NOT EXISTS releases_app_pub_idx ON releases(app_id, published_at)`,
      `CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY,
        release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        digest TEXT,
        browser_download_url TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS assets_release_idx ON assets(release_id)`,
      `CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        release_id INTEGER,
        asset_id INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE INDEX IF NOT EXISTS downloads_app_idx ON downloads(app_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS downloads_release_idx ON downloads(release_id)`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE INDEX IF NOT EXISTS login_attempts_key_idx ON login_attempts(key, created_at)`,
    ],
  },
  {
    id: 2,
    sql: [`CREATE TABLE IF NOT EXISTS auth_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`],
  },
];

export async function migrate(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()))",
  );
  const done = new Set((await client.execute("SELECT id FROM _migrations")).rows.map((r) => Number(r.id)));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await client.batch([...m.sql, { sql: "INSERT OR IGNORE INTO _migrations (id) VALUES (?)", args: [m.id] }], "write");
  }
}
