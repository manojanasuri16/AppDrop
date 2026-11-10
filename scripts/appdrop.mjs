#!/usr/bin/env node
// AppDrop publishing CLI. Zero dependencies, Node >= 18.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ───────────────────────── output helpers ─────────────────────────
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const green = (s) => c(32, s), red = (s) => c(31, s), yellow = (s) => c(33, s), dim = (s) => c(2, s), bold = (s) => c(1, s);
let QUIET = false; // set when --json: human output goes to stderr
const out = (...a) => (QUIET ? console.error : console.log)(...a);
const ok = (m) => out(`${green("✓")} ${m}`);
const info = (m) => out(`  ${dim(m)}`);
const warn = (m) => out(`${yellow("!")} ${m}`);
class Fail extends Error {}
const fail = (m) => { throw new Fail(m); };

const mask = (k) => (!k ? "(none)" : k.length <= 8 ? "****" : `${k.slice(0, 4)}…${k.slice(-2)} (${k.length} chars)`);

// ───────────────────────── arg parsing ─────────────────────────
function parseArgs(argv, spec) {
  const flags = {}, pos = [];
  const bools = new Set(spec.bool ?? []), strs = new Set(spec.str ?? []);
  const alias = spec.alias ?? {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (a === "--") { pos.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("-") && a.length > 1 && !/^-\d/.test(a)) {
      let val;
      if (a.startsWith("--") && a.includes("=")) { const j = a.indexOf("="); val = a.slice(j + 1); a = a.slice(0, j); }
      const name = alias[a] ?? a.replace(/^--?/, "");
      if (name === "help" || a === "-h") { flags.help = true; continue; }
      if (bools.has(name)) {
        flags[name] = val === undefined ? true : !/^(false|0|no)$/i.test(val);
      } else if (strs.has(name)) {
        if (val === undefined) {
          val = argv[++i];
          if (val === undefined) fail(`Option ${a} needs a value`);
        }
        flags[name] = val;
      } else fail(`Unknown option ${a}. Try --help.`);
    } else pos.push(a);
  }
  return { flags, pos };
}

// ───────────────────────── config & API ─────────────────────────
const CONFIG_DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "appdrop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// The API key is a bearer secret: only send it over https (plain http allowed for local dev only).
function secureUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || (x.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(x.hostname));
  } catch { return false; }
}

function loadConfig() {
  let f = {};
  try { f = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch {}
  const url = (process.env.APPDROP_URL || f.url || "").replace(/\/+$/, "");
  const key = process.env.APPDROP_API_KEY || f.key || "";
  return { url, key };
}

function requireConfig() {
  const cfg = loadConfig();
  if (!cfg.url || !cfg.key) {
    fail("AppDrop is not configured. Run: appdrop login --url https://your-appdrop.example --key <APPDROP_API_KEY>\n  (or set APPDROP_URL and APPDROP_API_KEY)");
  }
  if (!secureUrl(cfg.url)) fail(`APPDROP_URL must be https:// (http only for localhost) — got "${cfg.url}"`);
  return cfg;
}

class ApiError extends Error {
  constructor(status, body, msg) { super(msg); this.status = status; this.body = body; }
}

async function api(method, route, { json, body, contentType, cfg } = {}) {
  cfg ??= requireConfig();
  const headers = { Authorization: `Bearer ${cfg.key}`, Accept: "application/json" };
  let payload;
  if (json !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(json); }
  else if (body) { headers["Content-Type"] = contentType; payload = body; }
  let res;
  try {
    res = await fetch(`${cfg.url}/api/v1${route}`, { method, headers, body: payload, signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    fail(`Could not reach ${cfg.url} (${e.cause?.code || e.message}). Is the server up and APPDROP_URL correct?`);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    let msg = data?.error || `HTTP ${res.status}`;
    if (res.status === 401) msg = "Invalid API key (401). Check APPDROP_API_KEY / run `appdrop login`.";
    else if (res.status === 404 && /disabled/i.test(msg)) msg += " (set APPDROP_API_KEY on the server)";
    else if (res.status === 429) msg = data?.error || "Rate limited (429)";
    if (data?.details && typeof data.details === "object") {
      msg += "\n" + Object.entries(data.details).map(([k, v]) => `    - ${k}: ${v}`).join("\n");
    } else if (data?.fields) {
      msg += "\n" + Object.entries(data.fields).map(([k, v]) => `    - ${k}: ${v}`).join("\n");
    }
    throw new ApiError(res.status, data, msg);
  }
  return data;
}

const NO_ACCESS = /Repository not found or token lacks access/i;
const accessHelp = (repo) =>
  `The server's GITHUB_TOKEN (fine-grained PAT) can't see ${repo || "this repo"}.\n  Fix: GitHub → Settings → Developer settings → Fine-grained tokens → edit your AppDrop token →\n  Repository access → add ${repo || "the repo"} (Contents: read, Metadata: read), then re-run \`appdrop publish\`.`;

// ───────────────────────── manifest ─────────────────────────
const MANIFEST_KEYS = ["slug", "kind", "name", "tagline", "description", "descriptionFile", "category", "developer", "accentColor", "packageName",
  "repo", "webUrl", "assetPattern", "includePrereleases", "visibility", "featured", "sortOrder", "icon", "screenshots"];
const API_FIELDS = ["kind", "name", "tagline", "description", "category", "developer", "accentColor", "packageName", "repo", "webUrl",
  "assetPattern", "includePrereleases", "visibility", "featured", "sortOrder"];
const MAX_IMG = 4 * 1024 * 1024;

const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function parseRepo(input) {
  const s = String(input).trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = s.match(/^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function readManifest(file) {
  const p = path.resolve(file || "appdrop.json");
  if (!fs.existsSync(p)) fail(`No manifest at ${p}. Run \`appdrop init\` in your app's folder first.`);
  let m;
  try { m = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { fail(`${p} is not valid JSON: ${e.message}`); }
  if (!m || typeof m !== "object" || Array.isArray(m)) fail(`${p} must contain a JSON object`);
  return { path: p, dir: path.dirname(p), data: m };
}

function validateManifest(man) {
  const m = man.data, errors = [], warnings = [];
  for (const k of Object.keys(m)) if (!MANIFEST_KEYS.includes(k)) warnings.push(`Unknown key "${k}" in appdrop.json (ignored)`);
  const str = (k, max) => {
    if (m[k] === undefined) return;
    if (typeof m[k] !== "string") errors.push(`${k}: must be a string`);
    else if (max && m[k].length > max) errors.push(`${k}: ${m[k].length} chars, max ${max}`);
  };
  str("name", 80); str("tagline", 120); str("description", 20000); str("category", 40); str("developer", 80); str("assetPattern", 100);
  if (!m.slug || typeof m.slug !== "string") errors.push("slug: required");
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug) || m.slug.length > 60) errors.push("slug: lowercase letters, numbers and dashes, max 60");
  if (m.kind !== undefined && !["android", "web"].includes(m.kind)) errors.push('kind: must be "android" or "web"');
  const kind = m.kind ?? (m.webUrl && !m.repo ? "web" : "android");
  if (!m.name) warnings.push("name is empty (required when creating the app)");
  if (m.accentColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(m.accentColor)) errors.push("accentColor: use a hex color like #0a84ff");
  if (m.packageName && !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(m.packageName)) errors.push("packageName: invalid");
  if (m.repo && !parseRepo(m.repo)) errors.push("repo: use owner/repo or a GitHub URL");
  if (m.webUrl) {
    try { const u = new URL(m.webUrl); if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) errors.push("webUrl: must be https://"); }
    catch { errors.push("webUrl: not a valid URL"); }
  }
  if (kind === "android" && !m.repo) errors.push("repo: Android apps need a GitHub repository (owner/repo)");
  if (kind === "web" && !m.webUrl) errors.push("webUrl: web apps need a deployed https URL");
  if (m.visibility !== undefined && !["public", "unlisted", "draft"].includes(m.visibility)) errors.push('visibility: "public", "unlisted" or "draft"');
  for (const k of ["includePrereleases", "featured"]) if (m[k] !== undefined && typeof m[k] !== "boolean") errors.push(`${k}: must be true or false`);
  if (m.sortOrder !== undefined && !(Number.isInteger(m.sortOrder) && Math.abs(m.sortOrder) <= 9999)) errors.push("sortOrder: integer between -9999 and 9999");
  if (m.description !== undefined && m.descriptionFile) warnings.push("Both description and descriptionFile set; descriptionFile wins");
  if (m.descriptionFile) {
    const f = path.resolve(man.dir, m.descriptionFile);
    if (!fs.existsSync(f)) errors.push(`descriptionFile: ${f} not found`);
  }
  if (m.icon !== undefined) {
    if (typeof m.icon !== "string") errors.push("icon: must be a path string");
    else { const e = checkImage(path.resolve(man.dir, m.icon), "icon"); if (e) errors.push(e); }
  }
  if (m.screenshots !== undefined) {
    if (!Array.isArray(m.screenshots) || m.screenshots.some((s) => typeof s !== "string")) errors.push("screenshots: must be an array of paths");
    else {
      if (m.screenshots.length > 12) errors.push(`screenshots: ${m.screenshots.length} listed, max 12`);
      m.screenshots.forEach((s, i) => { const e = checkImage(path.resolve(man.dir, s), `screenshots[${i}]`); if (e) errors.push(e); });
    }
  }
  return { errors, warnings, kind };
}

function sniffImage(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (buf.length > 6 && /^GIF8[79]a/.test(buf.toString("latin1", 0, 6))) return "image/gif";
  return null;
}

function checkImage(file, label) {
  let st;
  try { st = fs.statSync(file); } catch { return `${label}: ${file} not found`; }
  if (!st.isFile()) return `${label}: ${file} is not a file`;
  if (st.size > MAX_IMG) return `${label}: ${file} is ${(st.size / 1048576).toFixed(1)} MB, max 4 MB`;
  const fd = fs.openSync(file, "r"); const b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd);
  if (!sniffImage(b)) return `${label}: ${file} is not a PNG/JPEG/WebP/GIF image (SVG and XML are not supported)`;
  return null;
}

// ───────────────────────── init: project detection ─────────────────────────
const exists = (...p) => fs.existsSync(path.join(...p));
const readText = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const lsDir = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
const IMG_RE = /\.(png|jpe?g|webp)$/i;

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

function detectKind(dir) {
  const gradle = ["app/build.gradle", "app/build.gradle.kts", "build.gradle", "build.gradle.kts"].map((f) => readText(path.join(dir, f)) ?? "").join("\n");
  if (/com\.android\.(application|library)|android\s*\{/.test(gradle) || exists(dir, "app/src/main/AndroidManifest.xml")) return "android";
  if (exists(dir, "package.json") || exists(dir, "index.html")) return "web";
  return null;
}

function findAndroidModule(dir) {
  for (const m of ["app", ""]) {
    for (const f of ["build.gradle.kts", "build.gradle"]) if (exists(dir, m, f)) return m;
  }
  return null;
}

function repoFromGit(dir) {
  const url = sh("git", ["remote", "get-url", "origin"], dir);
  const m = url.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : "";
}

function pickImage(dir, rels) {
  for (const r of rels) { const f = path.join(dir, r); if (isFile(f)) return r; }
  return "";
}

function findScreenshots(dir) {
  const own = path.join(dir, "appdrop", "screenshots");
  let list = lsDir(own).filter((f) => IMG_RE.test(f)).sort().map((f) => `appdrop/screenshots/${f}`);
  if (list.length) return list;
  const fl = path.join(dir, "fastlane/metadata/android");
  for (const loc of lsDir(fl).sort()) {
    const d = path.join(fl, loc, "images", "phoneScreenshots");
    list = lsDir(d).filter((f) => IMG_RE.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((f) => `fastlane/metadata/android/${loc}/images/phoneScreenshots/${f}`);
    if (list.length) return list.slice(0, 12);
  }
  return [];
}

function findColor(dir, names) {
  const res = [];
  const walk = (d, depth) => {
    if (depth > 6) return;
    for (const e of lsDir(d)) {
      if (["node_modules", "build", ".git", ".gradle"].includes(e)) continue;
      const f = path.join(d, e);
      if (e === "colors.xml") res.push(f);
      else if (depth < 6 && fs.statSync(f).isDirectory()) walk(f, depth + 1);
    }
  };
  walk(dir, 0);
  for (const n of names) for (const f of res) {
    const m = readText(f)?.match(new RegExp(`<color\\s+name="${n}">\\s*#(?:[0-9a-fA-F]{2})?([0-9a-fA-F]{6})\\s*</color>`));
    if (m) return "#" + m[1].toLowerCase();
  }
  return "";
}

function detectAndroid(dir) {
  const d = { kind: "android", notes: [] };
  const mod = findAndroidModule(dir);
  const gradleText = mod === null ? "" : ["build.gradle.kts", "build.gradle"].map((f) => readText(path.join(dir, mod, f)) ?? "").join("\n");
  d.packageName = gradleText.match(/applicationId\s*=?\s*["']([^"']+)["']/)?.[1] ?? gradleText.match(/namespace\s*=?\s*["']([^"']+)["']/)?.[1] ?? "";
  d.versionName = gradleText.match(/versionName\s*=?\s*["']([^"']+)["']/)?.[1] ?? "";
  const modDir = mod ?? "app";
  const strings = readText(path.join(dir, modDir, "src/main/res/values/strings.xml")) ?? "";
  const nm = strings.match(/<string\s+name="app_name"[^>]*>([\s\S]*?)<\/string>/)?.[1];
  d.name = nm ? nm.replace(/\\'/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";
  const res = `${modDir}/src/main/res`;
  const fastIcons = lsDir(path.join(dir, "fastlane/metadata/android")).map((l) => `fastlane/metadata/android/${l}/images/icon.png`);
  const cands = [`${modDir}/src/main/ic_launcher-playstore.png`, ...fastIcons];
  for (const dens of ["xxxhdpi", "xxhdpi", "xhdpi", "hdpi", "mdpi"]) for (const n of ["ic_launcher", "ic_launcher_round"]) for (const ext of ["png", "webp"]) cands.push(`${res}/mipmap-${dens}/${n}.${ext}`);
  d.icon = pickImage(dir, cands);
  d.repo = repoFromGit(dir);
  d.screenshots = findScreenshots(dir);
  d.accentColor = findColor(path.join(dir, modDir, "src/main/res"), ["colorPrimary", "primary", "md_theme_primary", "seed", "ic_launcher_background", "purple_500"]);
  const readme = readText(path.join(dir, "README.md")) ?? "";
  d.tagline = readme.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !/^[#!\[<>|`-]/.test(l) && l.length > 15)?.slice(0, 120) ?? "";
  if (!d.packageName) d.notes.push("applicationId not found");
  if (!d.repo) d.notes.push("no GitHub `origin` remote");
  return d;
}

function bestManifestIcon(dir, mf) {
  const j = readJson(mf);
  if (!j?.icons) return "";
  let best = "", bs = 0;
  for (const ic of j.icons) {
    if (!ic.src || !IMG_RE.test(ic.src.split("?")[0])) continue;
    const size = Math.max(0, ...String(ic.sizes || "0").split(/\s+/).map((s) => parseInt(s, 10) || 0));
    const rel = path.relative(dir, path.join(path.dirname(mf), ic.src.startsWith("/") ? path.join(dir, "public", ic.src) : ic.src));
    const abs = ic.src.startsWith("/") ? [path.join(dir, "public", ic.src), path.join(dir, ic.src)].find(isFile) : path.join(path.dirname(mf), ic.src);
    if (abs && isFile(abs) && size > bs) { bs = size; best = path.relative(dir, abs); }
  }
  return best;
}

function detectWeb(dir) {
  const d = { kind: "web", notes: [] };
  const pkg = readJson(path.join(dir, "package.json")) ?? {};
  const pretty = (s) => String(s).replace(/^@[^/]+\//, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
  d.name = pkg.name ? pretty(pkg.name) : path.basename(dir);
  const hp = typeof pkg.homepage === "string" ? pkg.homepage : "";
  d.webUrl = /^https:\/\//.test(hp) ? hp : "";
  d.tagline = typeof pkg.description === "string" ? pkg.description.slice(0, 120) : "";
  const pubs = ["public", "static", "."];
  let icon = "";
  for (const p of pubs) {
    icon = pickImage(dir, ["icon-512.png", "icons/icon-512.png", "icon-512x512.png", "android-chrome-512x512.png", "apple-touch-icon.png", "icon-192.png", "icons/icon-192.png", "android-chrome-192x192.png", "logo512.png", "logo.png", "icon.png"].map((f) => `${p}/${f}`).map((f) => f.replace(/^\.\//, "")));
    if (icon) break;
  }
  let theme = "";
  for (const p of ["public", "static", "."]) for (const mfn of ["manifest.json", "manifest.webmanifest", "site.webmanifest"]) {
    const mf = path.join(dir, p, mfn);
    if (!isFile(mf)) continue;
    const j = readJson(mf);
    if (j?.theme_color && /^#[0-9a-f]{6}$/i.test(j.theme_color)) theme ||= j.theme_color.toLowerCase();
    const bi = bestManifestIcon(dir, mf);
    if (bi && (!icon || /192|apple-touch/.test(icon))) icon = bi;
    if (!d.tagline && typeof j?.description === "string") d.tagline = j.description.slice(0, 120);
  }
  d.icon = icon;
  d.accentColor = theme;
  d.screenshots = findScreenshots(dir);
  d.repo = "";
  if (!d.webUrl) d.notes.push("deployed URL unknown (package.json homepage is not an https URL)");
  return d;
}

// ───────────────────────── commands ─────────────────────────
const HELP = {
  main: `${bold("appdrop")} — publish apps to your AppDrop store

Usage: appdrop <command> [options]

Commands:
  login              Save the AppDrop URL and API key
  init               Detect the project in the current folder and write appdrop.json
  publish            Push metadata, icon and screenshots, then sync releases
  release            Create/update a GitHub release with an APK, then sync
  status [slug]      Show an app's state on the server
  list               List all apps on the server
  screenshot-web     Capture screenshots of a web app with headless Chrome
  screenshot-android Capture a screenshot from a connected Android device/emulator
  add-updater        Add the in-app update checker + feedback (AppDropUpdater.kt) to an Android project

Run \`appdrop <command> --help\` for details.
Config: APPDROP_URL / APPDROP_API_KEY env vars override ${CONFIG_FILE}`,
  login: `Usage: appdrop login --url <url> --key <key>

Verifies the credentials with GET /api/v1/apps, then saves them to
${CONFIG_FILE} (file mode 0600). The key is never printed.`,
  init: `Usage: appdrop init [--kind android|web] [--force]

Detects the project in the current directory and writes appdrop.json:
  Android: applicationId, app_name, versionName, launcher icon, git remote, screenshots
  Web:     package.json name/homepage/description, public/ icons, manifest theme color
Refuses to overwrite an existing appdrop.json unless --force.`,
  publish: `Usage: appdrop publish [-m appdrop.json] [--dry-run] [--skip-icon] [--skip-screenshots] [--json]

Validates the manifest, then: PUT metadata, PUT icon, replace screenshots (delete all,
then upload in order), POST sync (if repo set). Prints store URL, download URL, version.
  -m, --manifest <file>   Manifest path (default ./appdrop.json)
  --dry-run               Validate and show the plan; no network calls
  --skip-icon             Don't upload the icon
  --skip-screenshots      Leave existing screenshots untouched
  --json                  Machine-readable result on stdout`,
  release: `Usage: appdrop release --tag <vX.Y.Z> --apk <path> [options]

Creates a GitHub release (or uploads to an existing one) with the APK using \`gh\`,
then asks AppDrop to sync. Requires \`gh auth login\`. Repo comes from appdrop.json.
  --tag <tag>             Release tag (required)
  --apk <path>            APK file (required, must end in .apk)
  --notes <text>          Release notes
  --notes-file <path>     Release notes from a file
  --generate-notes        Let GitHub generate notes
  --title <title>         Release title (default: the tag)
  --prerelease            Mark as pre-release
  --draft=false           Accepted for clarity; draft releases are never created
  -m, --manifest <file>   Manifest path (default ./appdrop.json)`,
  status: `Usage: appdrop status [slug] [-m appdrop.json] [--json]

Shows the app's visibility, version, releases, downloads and sync state.
slug defaults to the one in appdrop.json.`,
  list: `Usage: appdrop list [--json]

Lists all apps on the server (any visibility).`,
  "screenshot-web": `Usage: appdrop screenshot-web <url> [options]

Headless Chrome screenshots (Chrome/Chromium auto-detected, or set $CHROME_PATH).
  --paths "/,/about"      Routes to capture (default "/")
  --out <dir>             Output dir (default appdrop/screenshots)
  --width 390 --height 844 --scale 2   Viewport (default phone, 2x)
  --dark                  Prefer dark color scheme
Files are named 01-home.png, 02-about.png, …; add them to "screenshots" in appdrop.json.`,
  "screenshot-android": `Usage: appdrop screenshot-android [--out appdrop/screenshots] [--name 01-home] [--serial <id>]

Captures the screen of the connected device/emulator via \`adb exec-out screencap -p\`.
Without --name, the next free NN-screen.png is used.`,
  "add-updater": `Usage: appdrop add-updater [--slug <slug>] [--base <url>]

Run inside an Android project. Copies the AppDrop in-app updater into the app:
  <module>/src/main/java/<namespace>/appdrop/AppDropUpdater.kt   (package line rewritten)
  <module>/src/main/res/xml/appdrop_file_paths.xml
then PRINTS the manifest, init() and check() snippets with your values filled in
(it never edits your manifest or code). Safe to re-run: it overwrites only its own files.
  --slug <slug>   App slug (default: "slug" in appdrop.json)
  --base <url>    AppDrop URL (default: the configured URL from \`appdrop login\`)`,
};

async function cmdLogin(argv) {
  const { flags } = parseArgs(argv, { str: ["url", "key"] });
  if (flags.help) return console.log(HELP.login);
  if (!flags.url || !flags.key) fail("Usage: appdrop login --url <url> --key <key>");
  const cfg = { url: flags.url.replace(/\/+$/, ""), key: flags.key };
  if (!secureUrl(cfg.url)) fail("--url must be https:// (http is allowed only for localhost)");
  await api("GET", "/apps", { cfg });
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(CONFIG_DIR, 0o700); } catch {}
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(CONFIG_FILE, 0o600);
  ok(`Logged in to ${cfg.url} (key ${mask(cfg.key)})`);
  info(`Saved to ${CONFIG_FILE}`);
}

async function cmdInit(argv) {
  const { flags } = parseArgs(argv, { str: ["kind"], bool: ["force"] });
  if (flags.help) return console.log(HELP.init);
  const dir = process.cwd();
  const target = path.join(dir, "appdrop.json");
  if (exists(target) && !flags.force) fail("appdrop.json already exists. Use --force to overwrite, or edit it by hand.");
  if (flags.kind && !["android", "web"].includes(flags.kind)) fail("--kind must be android or web");
  const kind = flags.kind || detectKind(dir);
  if (!kind) fail("Couldn't tell what kind of project this is. Re-run with --kind android|web.");
  const d = kind === "android" ? detectAndroid(dir) : detectWeb(dir);
  const name = d.name || path.basename(dir);
  const developer = sh("git", ["config", "user.name"], dir);
  const m = { slug: slugify(name) || "my-app", kind, name };
  m.tagline = d.tagline || (kind === "android" ? `${name} for Android` : `${name} on the web`);
  m.category = kind === "android" ? "Utilities" : "Tools";
  if (developer) m.developer = developer;
  m.accentColor = d.accentColor || "#0a84ff";
  if (kind === "android") { if (d.packageName) m.packageName = d.packageName; if (d.repo) m.repo = d.repo; }
  else m.webUrl = d.webUrl;
  m.visibility = "public";
  if (d.icon) m.icon = d.icon;
  if (d.screenshots.length) m.screenshots = d.screenshots;
  fs.writeFileSync(target, JSON.stringify(m, null, 2) + "\n");
  ok(`Wrote ${target}`);
  out(`  Detected ${bold(kind)} project:`);
  const row = (k, v) => out(`    ${k.padEnd(13)} ${v ? v : dim("(not found)")}`);
  row("name", name); row("slug", m.slug);
  if (kind === "android") { row("applicationId", d.packageName); row("versionName", d.versionName); row("repo", d.repo); }
  else { row("webUrl", d.webUrl); }
  row("icon", d.icon); row("screenshots", d.screenshots.length ? `${d.screenshots.length} found` : "");
  row("accentColor", d.accentColor ? d.accentColor : `${m.accentColor} (default)`);
  const todo = [];
  if (kind === "android" && !d.repo) todo.push('set "repo" to owner/repo (add a GitHub `origin` remote first)');
  if (kind === "web" && !d.webUrl) todo.push('set "webUrl" to the deployed https URL');
  if (!d.icon) todo.push('add an "icon" (square PNG, 512px+)');
  if (!d.screenshots.length) todo.push('add 3-8 phone screenshots to appdrop/screenshots/ and list them in "screenshots"');
  todo.push('write a rich markdown "description" (or "descriptionFile") and polish "tagline"/"category"');
  out(`\n${yellow("Still to do:")}`);
  todo.forEach((t) => out(`  - ${t}`));
  out(`\nNext: edit appdrop.json, then \`appdrop publish --dry-run\`.`);
}

function resolveDescription(man) {
  const m = man.data;
  if (m.descriptionFile) return fs.readFileSync(path.resolve(man.dir, m.descriptionFile), "utf8");
  return m.description;
}

async function cmdPublish(argv) {
  const { flags } = parseArgs(argv, { str: ["manifest"], bool: ["dry-run", "skip-icon", "skip-screenshots", "json"], alias: { "-m": "manifest" } });
  if (flags.help) return console.log(HELP.publish);
  QUIET = !!flags.json;
  const man = readManifest(flags.manifest);
  const { errors, warnings, kind } = validateManifest(man);
  warnings.forEach(warn);
  if (errors.length) fail(`appdrop.json has problems:\n${errors.map((e) => `    - ${e}`).join("\n")}`);
  const m = man.data;
  const body = {};
  for (const k of API_FIELDS) if (m[k] !== undefined) body[k] = m[k];
  body.kind = kind;
  const desc = resolveDescription(man);
  if (desc !== undefined) body.description = desc;
  if (!desc && !m.descriptionFile) warnings.length || warn("No description set; the store page will use the repo description (if any)");
  const icon = m.icon && !flags["skip-icon"] ? path.resolve(man.dir, m.icon) : null;
  const shots = Array.isArray(m.screenshots) && !flags["skip-screenshots"] ? m.screenshots.map((s) => path.resolve(man.dir, s)) : null;

  if (flags["dry-run"]) {
    ok(`Manifest valid (${m.slug}, ${kind})`);
    out(`  PUT    /apps/${m.slug}  fields: ${Object.keys(body).join(", ")}${desc ? ` (description ${desc.length} chars)` : ""}`);
    if (icon) out(`  PUT    /apps/${m.slug}/icon  ${icon}`);
    if (shots) { out(`  DELETE /apps/${m.slug}/screenshots`); shots.forEach((s, i) => out(`  POST   /apps/${m.slug}/screenshots  #${i + 1} ${s}`)); }
    if (m.repo) out(`  POST   /apps/${m.slug}/sync`);
    out(dim("Dry run: nothing was sent."));
    if (flags.json) console.log(JSON.stringify({ dryRun: true, slug: m.slug, kind, fields: body, icon, screenshots: shots }, null, 2));
    return;
  }

  const cfg = requireConfig();
  const slug = m.slug;
  let put;
  try { put = await api("PUT", `/apps/${slug}`, { json: body, cfg }); }
  catch (e) {
    if (e instanceof ApiError && NO_ACCESS.test(e.message)) fail(`${e.message}\n  ${accessHelp(m.repo)}`);
    throw e;
  }
  ok(`${put.created ? "Created" : "Updated"} ${put.app.name} (${slug})`);
  if (icon) {
    const buf = fs.readFileSync(icon);
    await api("PUT", `/apps/${slug}/icon`, { body: buf, contentType: sniffImage(buf), cfg });
    ok(`Icon uploaded (${path.relative(process.cwd(), icon)})`);
  }
  if (shots) {
    await api("DELETE", `/apps/${slug}/screenshots`, { cfg });
    let n = 0;
    for (const s of shots) {
      const buf = fs.readFileSync(s);
      await api("POST", `/apps/${slug}/screenshots`, { body: buf, contentType: sniffImage(buf), cfg });
      n++;
    }
    ok(`${n} screenshot${n === 1 ? "" : "s"} uploaded`);
  }
  let sync = put.sync ?? null, app = put.app;
  if (m.repo) {
    try { const r = await api("POST", `/apps/${slug}/sync`, { cfg }); sync = r.sync; app = r.app; }
    catch (e) { sync = { ok: false, error: e.message }; app = (await api("GET", `/apps/${slug}`, { cfg })).app; }
  } else app = (await api("GET", `/apps/${slug}`, { cfg })).app;

  let syncFailed = false;
  if (m.repo) {
    if (sync?.ok) ok(`Synced ${sync.releases} release${sync.releases === 1 ? "" : "s"} from ${m.repo}`);
    else {
      syncFailed = true;
      out(`${red("✗")} Sync failed: ${sync?.error || "unknown error"}`);
      if (NO_ACCESS.test(sync?.error || "")) out(`  ${accessHelp(m.repo)}`);
      else if (/no .*apk|asset/i.test(sync?.error || "")) out(`  Make sure a release has an .apk asset, or set "assetPattern" in appdrop.json.`);
    }
  }
  if (flags.json) console.log(JSON.stringify({ created: put.created, sync, app }, null, 2));
  else printSummary(app, sync);
  if (syncFailed) process.exitCode = 1;
}

function printSummary(a, sync) {
  out("");
  out(`  ${bold("Store page")}   ${a.url}`);
  if (a.kind === "android") out(`  ${bold("Download")}     ${a.downloadUrl}`);
  if (a.webUrl) out(`  ${bold("Web app")}      ${a.webUrl}`);
  out(`  ${bold("Visibility")}   ${a.visibility}${a.visibility !== "public" ? dim("  (set visibility: public in appdrop.json to list it)") : ""}`);
  if (a.kind === "android") out(`  ${bold("Version")}      ${a.latestVersion || dim("none yet (no release synced)")}`);
  out(`  ${bold("Sync")}         ${a.syncError ? red("error: " + a.syncError) : a.lastSyncedAt ? green("ok") + dim(` (${a.lastSyncedAt})`) : dim(a.repo ? "not yet" : "n/a")}`);
}

function runCap(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let p;
    try { p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts }); }
    catch (e) { return resolve({ code: -1, stdout: Buffer.alloc(0), stderr: String(e.message), err: e }); }
    const o = [], e = [];
    p.stdout.on("data", (d) => o.push(d)); p.stderr.on("data", (d) => e.push(d));
    p.on("error", (err) => resolve({ code: -1, stdout: Buffer.alloc(0), stderr: err.message, err }));
    p.on("close", (code) => resolve({ code, stdout: Buffer.concat(o), stderr: Buffer.concat(e).toString() }));
  });
}

function runInherit(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", () => resolve(-1));
    p.on("close", (code) => resolve(code));
  });
}

async function cmdRelease(argv) {
  const { flags } = parseArgs(argv, { str: ["tag", "apk", "notes", "notes-file", "title", "manifest"], bool: ["generate-notes", "prerelease", "draft"], alias: { "-m": "manifest" } });
  if (flags.help) return console.log(HELP.release);
  if (!flags.tag) fail("--tag is required (e.g. --tag v1.2.0)");
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-+/]*$/.test(flags.tag)) fail(`Invalid tag "${flags.tag}"`);
  if (!flags.apk) fail("--apk <path> is required");
  if (flags.draft === true) fail("Draft releases are ignored by AppDrop; not creating one.");
  const noteOpts = [flags.notes !== undefined, flags["notes-file"] !== undefined, !!flags["generate-notes"]].filter(Boolean).length;
  if (noteOpts > 1) fail("Use only one of --notes, --notes-file, --generate-notes");
  const apk = path.resolve(flags.apk);
  if (!apk.toLowerCase().endsWith(".apk")) fail(`${apk} must end with .apk`);
  if (!isFile(apk)) fail(`APK not found: ${apk}`);
  if (flags["notes-file"] && !isFile(path.resolve(flags["notes-file"]))) fail(`Notes file not found: ${flags["notes-file"]}`);
  const man = readManifest(flags.manifest);
  const repo = man.data.repo && parseRepo(man.data.repo);
  if (!repo) fail('appdrop.json needs a valid "repo" (owner/repo) to release');
  const slug = man.data.slug;
  const full = `${repo.owner}/${repo.repo}`;

  const auth = await runCap("gh", ["auth", "status"]);
  if (auth.err) fail("The GitHub CLI (`gh`) is not installed. Install it from https://cli.github.com/ and run `gh auth login`.");
  if (auth.code !== 0) fail("`gh` is not logged in. Run `gh auth login` first.");

  const view = await runCap("gh", ["release", "view", flags.tag, "--repo", full, "--json", "isDraft"]);
  let code;
  if (view.code === 0) {
    out(`Release ${flags.tag} exists; uploading APK (replacing same-named asset)…`);
    code = await runInherit("gh", ["release", "upload", flags.tag, apk, "--clobber", "--repo", full]);
  } else {
    const args = ["release", "create", flags.tag, apk, "--repo", full, "--title", flags.title || flags.tag];
    if (flags.notes !== undefined) args.push("--notes", flags.notes);
    else if (flags["notes-file"]) args.push("--notes-file", path.resolve(flags["notes-file"]));
    else if (flags["generate-notes"]) args.push("--generate-notes");
    else args.push("--notes", "");
    if (flags.prerelease) args.push("--prerelease");
    out(`Creating release ${flags.tag} on ${full}…`);
    code = await runInherit("gh", args);
  }
  if (code !== 0) fail(`gh failed (exit ${code}). Does the tag exist/was it pushed, and do you have write access to ${full}?`);
  ok(`GitHub release ${flags.tag} ready with ${path.basename(apk)}`);

  const r = await api("POST", `/apps/${slug}/sync`);
  if (!r.sync?.ok) {
    out(`${red("✗")} Sync failed: ${r.sync?.error}`);
    if (NO_ACCESS.test(r.sync?.error || "")) out(`  ${accessHelp(full)}`);
    process.exitCode = 1;
    return;
  }
  ok(`Synced; latest version on AppDrop: ${bold(r.app.latestVersion || "(none)")}`);
  info(r.app.url);
}

async function cmdStatus(argv) {
  const { flags, pos } = parseArgs(argv, { str: ["manifest"], bool: ["json"], alias: { "-m": "manifest" } });
  if (flags.help) return console.log(HELP.status);
  QUIET = false;
  let slug = pos[0];
  if (!slug) slug = readManifest(flags.manifest).data.slug;
  if (!slug) fail("No slug given and none in appdrop.json");
  let r;
  try { r = await api("GET", `/apps/${slug}`); }
  catch (e) { if (e instanceof ApiError && e.status === 404) fail(`No app "${slug}" on the server yet. Run \`appdrop publish\`.`); throw e; }
  if (flags.json) return console.log(JSON.stringify(r.app, null, 2));
  const a = r.app;
  out(`${bold(a.name)} ${dim(`(${a.slug}, ${a.kind}${a.featured ? ", featured" : ""})`)}`);
  printSummary(a);
  out(`  ${bold("Releases")}     ${a.releases}   ${bold("Downloads")} ${a.downloads}   ${bold("Screenshots")} ${a.screenshots}   ${bold("Icon")} ${a.hasIcon ? "yes" : "no"}`);
  if (a.repo) out(`  ${bold("Repo")}         ${a.repo}${a.repoPrivate ? " (private)" : ""}`);
}

async function cmdList(argv) {
  const { flags } = parseArgs(argv, { bool: ["json"] });
  if (flags.help) return console.log(HELP.list);
  const r = await api("GET", "/apps");
  if (flags.json) return console.log(JSON.stringify(r.apps, null, 2));
  if (!r.apps.length) return out("No apps yet.");
  const w = Math.max(...r.apps.map((a) => a.slug.length));
  for (const a of r.apps) out(`  ${a.slug.padEnd(w)}  ${a.kind.padEnd(7)} ${a.visibility.padEnd(9)} ${dim(a.repo || a.webUrl || "")}  ${a.name}`);
  out(dim(`${r.apps.length} app${r.apps.length === 1 ? "" : "s"}`));
}

function findChrome() {
  const cands = [process.env.CHROME_PATH, "google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].filter(Boolean);
  for (const cnd of cands) {
    if (cnd.includes("/")) { if (isFile(cnd)) return cnd; continue; }
    for (const d of (process.env.PATH || "").split(path.delimiter)) if (d && isFile(path.join(d, cnd))) return path.join(d, cnd);
  }
  return null;
}

// Chrome often lingers after writing the screenshot, so wait for the file and then kill the process group.
function captureWithChrome(chrome, args, file, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const p = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"], detached: true });
    let stderr = "", done = false, lastSize = -1;
    p.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
    const finish = (timedOut) => {
      if (done) return; done = true; clearInterval(iv); clearTimeout(to);
      try { process.kill(-p.pid, "SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch {} }
      resolve({ timedOut, stderr });
    };
    const iv = setInterval(() => {
      try { const sz = fs.statSync(file).size; if (sz > 0 && sz === lastSize) finish(false); lastSize = sz; } catch {}
    }, 400);
    const to = setTimeout(() => finish(true), timeoutMs);
    p.on("error", (e) => { stderr = e.message; finish(false); });
    p.on("close", () => finish(false));
  });
}

async function cmdScreenshotWeb(argv) {
  const { flags, pos } = parseArgs(argv, { str: ["paths", "out", "width", "height", "scale"], bool: ["dark"] });
  if (flags.help) return console.log(HELP["screenshot-web"]);
  const base = pos[0];
  if (!base) fail("Usage: appdrop screenshot-web <url> [--paths \"/,/about\"]");
  let baseUrl;
  try { baseUrl = new URL(base); } catch { fail(`Not a valid URL: ${base}`); }
  const chrome = findChrome();
  if (!chrome) fail("Chrome/Chromium not found. Install it or set CHROME_PATH=/path/to/chrome.");
  const W = parseInt(flags.width ?? "390", 10), H = parseInt(flags.height ?? "844", 10), S = Number(flags.scale ?? "2");
  if (!(W > 0 && H > 0 && S > 0)) fail("--width, --height and --scale must be positive numbers");
  const outDir = path.resolve(flags.out || "appdrop/screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  const paths = (flags.paths || "/").split(",").map((s) => s.trim()).filter(Boolean);
  const files = [];
  let i = 0;
  for (const p of paths) {
    i++;
    const url = new URL(p, baseUrl).toString();
    const slugPart = slugify(p.replace(/^\/+|\/+$/g, "").split("?")[0].replace(/\//g, "-")) || "home";
    const file = path.join(outDir, `${String(i).padStart(2, "0")}-${slugPart}${flags.dark ? "-dark" : ""}.png`);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "appdrop-chrome-"));
    const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--window-size=${W},${H}`, `--force-device-scale-factor=${S}`,
      "--virtual-time-budget=4000", `--user-data-dir=${profile}`, `--screenshot=${file}`];
    if (flags.dark) args.push("--blink-settings=preferredColorScheme=0", "--enable-features=WebContentsForceDark");
    args.push(url);
    try {
      const r = await captureWithChrome(chrome, args, file);
      if (!isFile(file)) fail(`Chrome didn't produce a screenshot for ${url}${r.timedOut ? " (timed out)" : ""}${r.stderr ? "\n" + r.stderr.split("\n").slice(-4).join("\n") : ""}`);
    } finally { fs.rmSync(profile, { recursive: true, force: true }); }
    ok(`${url} → ${path.relative(process.cwd(), file)} (${W * S}x${H * S})`);
    files.push(file);
  }
  out(`\nAdd to appdrop.json:\n  "screenshots": ${JSON.stringify(files.map((f) => path.relative(process.cwd(), f)))}`);
}

async function cmdScreenshotAndroid(argv) {
  const { flags } = parseArgs(argv, { str: ["out", "name", "serial"] });
  if (flags.help) return console.log(HELP["screenshot-android"]);
  const adbArgs = flags.serial ? ["-s", flags.serial] : [];
  const dev = await runCap("adb", ["devices"]);
  if (dev.err) fail("`adb` not found. Install Android platform-tools and make sure it's on PATH.");
  const online = dev.stdout.toString().split("\n").slice(1).filter((l) => /\tdevice\b/.test(l));
  if (!online.length) fail("No Android device/emulator connected. Plug one in (USB debugging on) or start an emulator, then check `adb devices`.");
  if (online.length > 1 && !flags.serial) fail(`Multiple devices connected; pass --serial. Found:\n${online.map((l) => "    " + l.split("\t")[0]).join("\n")}`);
  const outDir = path.resolve(flags.out || "appdrop/screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  let name = flags.name;
  if (!name) {
    const n = lsDir(outDir).filter((f) => /^\d\d-/.test(f)).length + 1;
    name = `${String(n).padStart(2, "0")}-screen`;
  }
  const file = path.join(outDir, name.endsWith(".png") ? name : `${name}.png`);
  const r = await runCap("adb", [...adbArgs, "exec-out", "screencap", "-p"]);
  if (r.code !== 0 || sniffImage(r.stdout) !== "image/png") fail(`screencap failed: ${r.stderr.trim() || "output was not a PNG"}`);
  fs.writeFileSync(file, r.stdout);
  ok(`Saved ${path.relative(process.cwd(), file)} (${(r.stdout.length / 1024).toFixed(0)} KB)`);
  info('Add it to "screenshots" in appdrop.json.');
}

async function cmdAddUpdater(argv) {
  const { flags } = parseArgs(argv, { str: ["slug", "base"] });
  if (flags.help) return console.log(HELP["add-updater"]);
  const dir = process.cwd();
  const mod = findAndroidModule(dir);
  if (mod === null || !exists(dir, mod, "src/main")) fail("No Android app module found here. Run this in the project root (expects app/build.gradle[.kts]).");
  const modDir = path.join(dir, mod);
  const gradle = ["build.gradle.kts", "build.gradle"].map((f) => readText(path.join(modDir, f)) ?? "").join("\n");
  const ns = gradle.match(/namespace\s*=?\s*["']([^"']+)["']/)?.[1] ?? gradle.match(/applicationId\s*=?\s*["']([^"']+)["']/)?.[1];
  if (!ns) fail("Could not find `namespace` or `applicationId` in the module's build.gradle[.kts].");
  const main = path.join(modDir, "src/main");
  const srcRoot = ["java", "kotlin"].map((d) => path.join(main, d)).find((d) => fs.existsSync(path.join(d, ...ns.split(".")))) ??
    ["java", "kotlin"].map((d) => path.join(main, d)).find((d) => fs.existsSync(d)) ?? path.join(main, "java");

  const man = readJson(path.join(dir, "appdrop.json"));
  const slug = flags.slug || man?.slug;
  if (!slug) fail("Slug unknown: pass --slug <slug> or run `appdrop init` first.");
  const base = (flags.base || loadConfig().url || "https://appdrop-store.vercel.app").replace(/\/+$/, "");

  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "android");
  const kt = readText(path.join(srcDir, "AppDropUpdater.kt"));
  const xml = readText(path.join(srcDir, "res/xml/appdrop_file_paths.xml"));
  if (!kt || !xml) fail(`AppDrop updater sources not found in ${srcDir}. Update your AppDrop checkout (git pull).`);

  const pkg = `${ns}.appdrop`;
  const ktOut = path.join(srcRoot, ...pkg.split("."), "AppDropUpdater.kt");
  const xmlOut = path.join(main, "res/xml/appdrop_file_paths.xml");
  for (const [f, content] of [[ktOut, kt.replace(/^package appdrop\s*$/m, `package ${pkg}`)], [xmlOut, xml]]) {
    const existed = fs.existsSync(f);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
    (existed ? warn : ok)(`${existed ? "Overwrote" : "Created"} ${path.relative(dir, f)}`);
  }

  const manifest = (readText(path.join(srcDir, "MANIFEST_SNIPPET.xml")) ?? "").replace(/<!--[\s\S]*?-->\s*/g, "").trim();
  out(`\n${bold("1. AndroidManifest.xml")} (${path.relative(dir, path.join(main, "AndroidManifest.xml"))}): add permissions inside <manifest>, provider inside <application>\n`);
  out(manifest.replace(/^/gm, "  "));
  out(`\n${bold("2. Application.onCreate()")} (create an Application class and set android:name if there is none)\n
  import ${pkg}.AppDropUpdater
  AppDropUpdater.init(this, "${base}", "${slug}")`);
  out(`\n${bold("3. Launcher activity")}\n
  override fun onResume() { super.onResume(); AppDropUpdater.check(this) }
  // menu items: AppDropUpdater.check(this, force = true)   AppDropUpdater.openFeedback(this)`);
  out(`\n${bold("4.")} Ensure androidx.core is a dependency (implementation("androidx.core:core-ktx")), and that versionName matches your release tags (1.4.0 <-> v1.4.0).`);
}

// ───────────────────────── main ─────────────────────────
const COMMANDS = {
  login: cmdLogin, init: cmdInit, publish: cmdPublish, release: cmdRelease, status: cmdStatus, list: cmdList,
  "screenshot-web": cmdScreenshotWeb, "screenshot-android": cmdScreenshotAndroid, "add-updater": cmdAddUpdater,
};

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    if (cmd === "help" && rest[0] && HELP[rest[0]]) return console.log(HELP[rest[0]]);
    return console.log(HELP.main);
  }
  if (cmd === "--version" || cmd === "-v") return console.log("appdrop-cli 1.0.0");
  const fn = COMMANDS[cmd];
  if (!fn) { console.error(`${red("✗")} Unknown command "${cmd}".\n`); console.error(HELP.main); process.exit(2); }
  await fn(rest);
}

main().catch((e) => {
  console.error(`${red("✗")} ${e instanceof Fail || e instanceof ApiError ? e.message : e?.stack || e}`);
  process.exit(1);
});
