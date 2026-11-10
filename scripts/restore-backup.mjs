#!/usr/bin/env node
/**
 * Restores a file written by scripts/backup.mjs into an EMPTY AppDrop database.
 *
 *   node scripts/restore-backup.mjs backups/backup-2026-11-10T03-30.ndjson.gz \
 *     --db libsql://your-db.turso.io --auth-token <token> [--yes] [--force]
 *
 * Run from the repo root (it imports @libsql/client from node_modules).
 *
 * Before restoring, the target schema must exist. Start AppDrop once against the new
 * database (it runs its migrations on boot), then run this script. The script refuses
 * to continue if the `apps` table is missing.
 *
 * --db          libsql:// or file: URL of the target database (required, no default on purpose)
 * --auth-token  token for a remote database (or set DATABASE_AUTH_TOKEN)
 * --yes         skip the interactive confirmation (required when stdin is not a TTY)
 * --force       allow restoring into a database that already has apps
 *               (rows with the same primary key cause the restore to fail, nothing is overwritten)
 *
 * Tables are restored one at a time in dependency order, in transactions of 200 rows.
 * If a run fails part way, the target is partly filled: start again with a fresh database.
 */
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { createGunzip } from "node:zlib";
import { createInterface as lineReader } from "node:readline";
import { createClient } from "@libsql/client";

// Dependency order (parents before children). Matches the tables served by /api/backup.
const ORDER = [
  "_migrations", "apps", "media", "releases", "assets", "screenshots", "downloads",
  "feedback", "beta_invites", "push_subscriptions", "version_pings", "page_views",
];
const BATCH = 200;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ROW_PREFIX = /^\{"type":"row","table":"([A-Za-z_][A-Za-z0-9_]*)"/;

function die(msg) {
  console.error(`restore: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { file: null, db: null, authToken: process.env.DATABASE_AUTH_TOKEN ?? null, yes: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--db") opts.db = argv[++i];
    else if (a === "--auth-token") opts.authToken = argv[++i];
    else if (a === "--yes") opts.yes = true;
    else if (a === "--force") opts.force = true;
    else if (a === "-h" || a === "--help") {
      console.log("Usage: node scripts/restore-backup.mjs <file.ndjson.gz> --db <url> [--auth-token <t>] [--yes] [--force]");
      process.exit(0);
    } else if (a.startsWith("--")) die(`unknown option: ${a}`);
    else if (opts.file) die("only one backup file can be given");
    else opts.file = a;
  }
  if (!opts.file) die("missing backup file (see --help)");
  if (!opts.db) die("missing --db <libsql-or-file-url> (see --help)");
  return opts;
}

/** Yields every non-empty line of the gzipped NDJSON file. */
async function* eachLine(file) {
  const gz = createReadStream(file).pipe(createGunzip());
  const rl = lineReader({ input: gz, crlfDelay: Infinity });
  gz.on("error", (e) => rl.emit("error", e));
  for await (const line of rl) if (line) yield line;
}

/** Decodes one exported row into SQLite values (drops __rowid, turns {$b64} into bytes). */
function decodeRow(row) {
  const cols = [];
  const args = [];
  for (const [k, v] of Object.entries(row)) {
    if (k === "__rowid") continue;
    if (!IDENT.test(k)) throw new Error(`unsafe column name in backup: ${k}`);
    let val = v;
    if (v === null || typeof v === "number" || typeof v === "string") val = v;
    else if (typeof v === "boolean") val = v ? 1 : 0;
    else if (typeof v === "object" && typeof v.$b64 === "string") val = new Uint8Array(Buffer.from(v.$b64, "base64"));
    else throw new Error(`unexpected value for column ${k}: ${JSON.stringify(v).slice(0, 80)}`);
    cols.push(k);
    args.push(val);
  }
  return { cols, args };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await access(opts.file).catch(() => die(`cannot read ${opts.file}`));

  // Pass 1: read the meta line and count rows per table (also catches unknown tables early).
  let meta = null;
  const counts = {};
  for await (const line of eachLine(opts.file)) {
    if (!meta) {
      meta = JSON.parse(line);
      if (meta.type !== "meta" || meta.version !== 1) die("not an AppDrop backup file (missing meta line, or unsupported version)");
      continue;
    }
    const m = ROW_PREFIX.exec(line);
    if (!m) die(`unexpected line in backup: ${line.slice(0, 80)}`);
    if (!ORDER.includes(m[1])) die(`backup contains an unknown table: ${m[1]}`);
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
  if (!meta) die("backup file is empty");
  const present = ORDER.filter((t) => counts[t] !== undefined);
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`restore: ${opts.file}`);
  console.log(`         exported ${meta.exportedAt ?? "unknown"}, ${totalRows} rows in ${Object.keys(counts).length} tables`);

  const db = createClient({ url: opts.db, authToken: opts.authToken ?? undefined });
  const tableExists = async (name) =>
    (await db.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [name] })).rows.length > 0;
  const countRows = async (name) => Number((await db.execute(`SELECT COUNT(*) AS n FROM "${name}"`)).rows[0].n);

  if (!(await tableExists("apps"))) {
    die(
      `the target database has no schema yet (no "apps" table).\n` +
        `  Start AppDrop once against this database so it migrates (it creates the tables on boot),\n` +
        `  for example with DATABASE_URL=${opts.db} npm run dev and open the site, then run this again.`,
    );
  }
  for (const t of present) {
    if (!(await tableExists(t))) die(`the target database has no "${t}" table. Start AppDrop once against it so it migrates, then retry.`);
  }

  const existingApps = await countRows("apps");
  if (existingApps > 0 && !opts.force) {
    die(`the target already has ${existingApps} app(s). Restore only into an empty database, or pass --force.`);
  }
  const skipMigrations = present.includes("_migrations") && (await countRows("_migrations")) > 0;

  const plan = present.filter((t) => !(t === "_migrations" && skipMigrations));
  console.log(`         target: ${opts.db}`);
  for (const t of present) {
    const note = t === "_migrations" && skipMigrations ? " (skipped, target already migrated)" : "";
    console.log(`           ${t.padEnd(20)} ${counts[t]}${note}`);
  }
  if (!plan.length) die("nothing to restore");

  if (!opts.yes) {
    if (!process.stdin.isTTY) die("refusing to restore without confirmation; pass --yes to run non-interactively");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\nWrite these rows into ${opts.db}? Type "restore" to continue: `);
    rl.close();
    if (answer.trim() !== "restore") die("aborted, nothing was written");
  }

  const started = Date.now();
  await db.execute("PRAGMA foreign_keys = OFF").catch(() => {});
  const inserted = {};
  for (const table of plan) {
    inserted[table] = 0;
    let pending = [];
    const flush = async () => {
      if (pending.length) await db.batch(pending, "write");
      pending = [];
    };
    const prefix = `{"type":"row","table":"${table}"`;
    try {
      for await (const line of eachLine(opts.file)) {
        if (!line.startsWith(prefix)) continue;
        const { row } = JSON.parse(line);
        const { cols, args } = decodeRow(row);
        const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
        pending.push({ sql, args });
        inserted[table]++;
        if (pending.length >= BATCH) await flush();
      }
      await flush();
    } catch (err) {
      die(`failed in table "${table}" after ${inserted[table]} rows: ${err.message}. The target is partly filled; use a fresh database to retry.`);
    }
    console.log(`  restored ${table.padEnd(20)} ${inserted[table]} rows`);
  }

  const fk = await db.execute("PRAGMA foreign_key_check").catch(() => null);
  const fkCount = fk?.rows.length ?? 0;
  if (fkCount) {
    console.warn(`restore: warning: ${fkCount} foreign key violation(s). This can happen when the export raced with writes. Sample: ${JSON.stringify(fk.rows[0])}`);
  }
  const total = Object.values(inserted).reduce((a, b) => a + b, 0);
  console.log(`\nrestore: done. ${total} rows in ${plan.length} tables, ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  console.log("Start AppDrop against this database and check the admin panel before switching DATABASE_URL.");
  db.close();
}

main().catch((err) => die(err.message));
