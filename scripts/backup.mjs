#!/usr/bin/env node
/**
 * Exports the AppDrop database through the backup API into a gzipped NDJSON file.
 *
 *   APPDROP_URL=https://your-appdrop.example BACKUP_TOKEN=... node scripts/backup.mjs [--out backups]
 *
 * Output: backup-<YYYY-MM-DDTHH-MM>.ndjson.gz
 *   line 1:  {"type":"meta", "version":1, "exportedAt":"...", "tables":{...}}
 *   others:  {"type":"row", "table":"apps", "row":{"__rowid":1, ...}}
 * Blob values are {"$b64": "..."}. Restore with scripts/restore-backup.mjs.
 *
 * Zero dependencies, Node 18+. Exits non-zero on any failure and never leaves a partial file behind.
 */
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const PAGE_TIMEOUT_MS = 30_000;
const RETRIES = 3; // retries after the first attempt, with exponential backoff (1s, 2s, 4s)

function die(msg) {
  console.error(`backup: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { out: "backups" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a.startsWith("--out=")) opts.out = a.slice("--out=".length);
    else if (a === "-h" || a === "--help") {
      console.log("Usage: APPDROP_URL=... BACKUP_TOKEN=... node scripts/backup.mjs [--out backups]");
      process.exit(0);
    } else die(`unknown argument: ${a}`);
  }
  if (!opts.out) die("--out needs a directory");
  return opts;
}

function baseUrl() {
  const raw = process.env.APPDROP_URL?.trim();
  if (!raw) die("APPDROP_URL is not set");
  let u;
  try {
    u = new URL(raw);
  } catch {
    die(`APPDROP_URL is not a valid URL: ${raw}`);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    die("APPDROP_URL must use https (http is only allowed for localhost)");
  }
  return u.origin;
}

function token() {
  const t = process.env.BACKUP_TOKEN?.trim();
  if (!t) die("BACKUP_TOKEN is not set");
  return t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET a JSON endpoint. Retries network errors, timeouts and 5xx; 4xx fails immediately. */
async function getJson(url, auth) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${auth}`, Accept: "application/json" },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const hint = res.status === 401 ? " (check BACKUP_TOKEN)" : res.status === 404 ? " (is BACKUP_TOKEN set on the server?)" : "";
        throw Object.assign(new Error(`HTTP ${res.status}${hint}: ${body.slice(0, 200)}`), { fatal: true });
      }
      return await res.json();
    } catch (err) {
      if (err.fatal) throw err;
      lastErr = err;
      console.warn(`backup: request failed (attempt ${attempt + 1}/${RETRIES + 1}): ${err.message}`);
    }
  }
  throw new Error(`giving up after ${RETRIES + 1} attempts: ${lastErr?.message ?? "unknown error"}`);
}

function stamp(date) {
  // 2026-11-10T03:30:12.000Z -> 2026-11-10T03-30
  return date.toISOString().slice(0, 16).replace(":", "-");
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const origin = baseUrl();
  const auth = token();
  const started = Date.now();

  const manifest = await getJson(`${origin}/api/backup`, auth);
  if (manifest.version !== 1) die(`unsupported backup format version: ${manifest.version}`);
  const tableNames = Object.keys(manifest.tables ?? {});
  console.log(`backup: exporting ${tableNames.length} tables from ${origin} (exportedAt ${manifest.exportedAt})`);

  // Rows actually exported per table, compared with the manifest once the export finishes.
  const exported = Object.fromEntries(tableNames.map((t) => [t, 0]));

  async function* lines() {
    yield JSON.stringify({ type: "meta", ...manifest }) + "\n";
    for (const table of tableNames) {
      let after = 0;
      for (;;) {
        const q = `${origin}/api/backup?table=${encodeURIComponent(table)}&after=${after}`;
        const page = await getJson(q, auth);
        for (const row of page.rows ?? []) {
          exported[table]++;
          yield JSON.stringify({ type: "row", table, row }) + "\n";
        }
        if (page.next == null) break;
        if (!(Number(page.next) > after)) throw new Error(`pagination did not advance for table ${table} (next=${page.next})`);
        after = Number(page.next);
      }
    }
  }

  await mkdir(opts.out, { recursive: true });
  const finalPath = resolve(join(opts.out, `backup-${stamp(new Date(manifest.exportedAt ?? Date.now()))}.ndjson.gz`));
  const partPath = `${finalPath}.part`;
  try {
    await pipeline(Readable.from(lines()), createGzip({ level: 9 }), createWriteStream(partPath));
    await rename(partPath, finalPath);
  } catch (err) {
    await rm(partPath, { force: true });
    die(err.message);
  }

  let mismatches = 0;
  for (const t of tableNames) {
    const want = Number(manifest.tables[t]);
    if (exported[t] !== want) {
      mismatches++;
      console.warn(`backup: warning: ${t} has ${exported[t]} rows, manifest said ${want} (data may have changed during export)`);
    }
  }

  const size = (await stat(finalPath)).size;
  const total = Object.values(exported).reduce((a, b) => a + b, 0);
  console.log("\nRows per table:");
  for (const t of tableNames) console.log(`  ${t.padEnd(20)} ${exported[t]}`);
  console.log(`\n${total} rows in ${tableNames.length} tables, ${human(size)} gzipped, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`wrote ${finalPath}`);
  if (mismatches) console.log(`${mismatches} table(s) differ from the manifest; see warnings above.`);
}

main().catch((err) => die(err.message));
