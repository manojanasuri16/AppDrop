# AppDrop

A personal app marketplace. Publish the Android apps and web apps you make for friends and family in one place, and let people install them straight from the source. Apps are backed by GitHub Releases, so shipping a new version is just cutting a release.

## Features

- **Android apps**: download the `.apk` straight from the release, with version, size and checksum info.
- **Web apps**: open them in the browser or install them as PWAs.
- **Installable store**: the store itself is a PWA with an offline page and an install prompt.
- **Auto-sync from GitHub**: release lists refresh in the background (stale-while-revalidate), with an optional webhook for instant updates.
- **Simple admin**: a password-protected panel to add apps, edit the listing and screenshots, and set visibility.
- **Private by design**: drafts are hidden, nothing is indexed, and the GitHub token never leaves the server.

## Architecture

- **Next.js 16** full-stack App Router (React 19, Server Actions, route handlers), output `standalone`.
- **SQLite / libSQL** through **Drizzle ORM**. A local `file:` database by default, or a Turso `libsql://` database. The schema migrates on boot.
- **GitHub REST API** for releases and assets, called only from the server with a fine-grained token.
- **Downloads** go through `/d/<slug>/<assetId>`, which resolves the asset from the app's own database and redirects to a short-lived signed GitHub URL.
- **Sync**: stale-while-revalidate with a `SYNC_TTL_MINUTES` window. An optional GitHub release webhook at `/api/webhooks/github` triggers an immediate resync.
- **PWA**: web app manifest, runtime-generated icons, and a hand-written service worker (`public/sw.js`).

## Local development

Requirements: Node.js 22+.

```bash
npm i
cp .env.example .env.local     # then fill in ADMIN_PASSWORD and SESSION_SECRET
npm run totp:setup             # scan the QR in your authenticator app, add ADMIN_TOTP_SECRET to .env.local
npm run dev
```

Open <http://localhost:3000>, then sign in at <http://localhost:3000/admin>.

Generate a session secret with `openssl rand -hex 32`.

## Creating a GitHub token

1. Go to **GitHub → Settings → Developer settings → Fine-grained personal access tokens → Generate new token**.
2. Name it (for example `appdrop`) and set an expiry.
3. Under **Repository access**, choose **Only select repositories** and pick the repos that contain your apps.
4. Under **Permissions**, set **Contents: Read-only** and **Metadata: Read-only**. Leave everything else off.
5. Generate the token and put it in `GITHUB_TOKEN` in `.env.local` (or your host's secrets).

The token is needed for private repos and raises the API rate limit. Public repos work without it.

## Adding apps

In `/admin`, add an app and point it at a GitHub repo (`owner/name`) or at a web app URL.

- **Android app**: pick the repo, then the sync pulls its releases and `.apk` assets. If a release has several APKs, set an **asset pattern** (for example `*-release.apk`). Otherwise an asset with `universal` in its name is preferred.
- **Web app**: give the app's URL. Visitors open it in the browser or install it from the store.

Visibility controls where an app shows: **public** lists it in the store, **unlisted** is reachable only by direct link, and **draft** is visible to the admin only.

## Release conventions

- Attach the built `.apk` files to a **GitHub Release**. Tag the release with the version (for example `v1.2.0`).
- If you publish several APKs in one release, name the one you want people to get with `universal` or match it with the asset pattern.
- Optional: add `fastlane/metadata/android/` to the repo (title, short and full descriptions, changelogs, screenshots). The admin can import it in one click to fill in the store listing.

## Webhook (optional, instant updates)

1. Set `GITHUB_WEBHOOK_SECRET` to a long random string, in `.env.local` or on your host.
2. In the repo, go to **Settings → Webhooks → Add webhook**:
   - **Payload URL**: `https://YOUR_HOST/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: the same value as `GITHUB_WEBHOOK_SECRET`
   - **Which events**: select **Let me select individual events**, then tick **Releases**.
3. Save. New releases now appear in the store right away instead of at the next TTL.

## Deployment

### Option 1: Docker on a VPS, Fly.io or Railway (recommended)

SQLite needs a persistent disk, so this is the simplest setup. The image declares `/app/data` as a volume.

```bash
docker build -t appdrop .
docker run -d --name appdrop -p 3000:3000 \
  -v appdrop-data:/app/data \
  -e ADMIN_PASSWORD='...' \
  -e ADMIN_TOTP_SECRET='...' \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e GITHUB_TOKEN='...' \
  appdrop
```

- **Fly.io**: create a volume (`fly volumes create appdrop_data --size 1`) and mount it at `/app/data`. Set the secrets with `fly secrets set`.
- **Railway**: add a volume mounted at `/app/data`, and set the variables in the service settings.
- Put a TLS-terminating proxy (Caddy, Traefik, or the platform's own) in front. HSTS is already set by the app.

### Option 2: Vercel + Turso

Use a hosted libSQL database so no disk is needed:

```bash
DATABASE_URL=libsql://your-db-your-org.turso.io
DATABASE_AUTH_TOKEN=...
```

Set the same `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`, `SESSION_SECRET` and `GITHUB_TOKEN` in the Vercel project settings.

## Security model

- **Two-factor admin login**: every sign-in needs the password **and** a 6-digit TOTP code (RFC 6238). Each code works only once (replay-protected), failures share one generic error, and attempts are rate-limited.


- **Token isolation**: the GitHub token is read on the server only and is never sent to the browser.
- **No IDOR on downloads**: asset IDs are resolved only through the app's own database rows. A client cannot ask for an arbitrary GitHub asset.
- **Admin auth**: a password check, then an HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie. Login is rate-limited. Every server action re-checks auth, and `/admin` is also gated in `src/proxy.ts`.
- **Uploads**: validated by magic bytes. SVG is rejected. Media is served with `X-Content-Type-Options: nosniff` and a sandbox CSP.
- **Headers**: a strict Content-Security-Policy, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` and HSTS are set on every response.
- **Downloads**: signed GitHub URLs are short-lived and resolved per request, never stored.
- **Visibility**: draft apps are admin-only, and unlisted apps are never listed in the store.
- **Indexing**: `robots` metadata is `noindex, nofollow`, and admin responses carry `X-Robots-Tag`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | Type check (`tsc --noEmit`) |
| `npm run db:generate` | Generate a Drizzle migration after editing `src/db/schema.ts` |

## Deploying to Netlify

Netlify builds Next.js 16 automatically, with no config file needed. Serverless functions have no persistent disk, so use a hosted database:

1. Create a free [Turso](https://turso.tech) database, then set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN`. Tables are created automatically on first request.
2. In Site settings → Environment variables, set `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`, `SESSION_SECRET`, `GITHUB_TOKEN` (and optionally `GITHUB_WEBHOOK_SECRET`).
3. Connect the GitHub repo. Build command `npm run build`, no publish directory override.

Notes: Netlify functions accept request bodies up to ~6 MB, so upload screenshots a few at a time. APK downloads are redirects to GitHub, so file size doesn't matter.
