---
name: appdrop-publish
description: Publish, list, update or release an app on AppDrop, the owner's personal app store. Use when the user says "add this app to AppDrop", "publish/list/put this on AppDrop", "release a new version", "ship this APK to AppDrop", "share this app with friends", or wants to update an AppDrop listing (icon, screenshots, description) for an Android app (APK via GitHub Releases) or a deployed web app.
---

# Publish an app to AppDrop

You are working inside the user's app project (any repo). Goal: get the app live on AppDrop end-to-end using the `appdrop` CLI. Work through the steps in order, skip what is already done, and report the store page URL and download URL at the end.

## Safety rules
- Never print, log or commit the API key, keystores or keystore passwords.
- The API cannot delete apps; deletion is done by the owner in `/admin` (password + 2FA). Don't promise otherwise.
- Don't release from uncommitted code. Commit first, tag the exact commit.
- Ask before making a private/unreleased app `public` if unsure. When in doubt use `"visibility": "unlisted"`.

## 0. Locate the CLI and check config
```bash
CLI="${APPDROP_HOME:-$HOME/AppDrop}/scripts/appdrop.mjs"
[ -f "$CLI" ] || gh repo clone manojanasuri16/AppDrop ~/AppDrop   # if present: git -C ~/AppDrop pull
node "$CLI" list      # also proves the config works
```
Use `appdrop ...` instead of `node "$CLI" ...` if it is on PATH. If `list` says not configured, ask the user for the AppDrop URL and API key, then `node "$CLI" login --url <url> --key <key>` (never echo the key back). `appdrop <command> --help` documents every option.

## 1. Identify the kind
- **Android**: Gradle project with an Android application module (`app/build.gradle(.kts)`). Needs a GitHub remote (`git remote get-url origin`); if none, offer `gh repo create` (private is fine).
- **Web**: a deployed app with an https URL. If you don't know the URL, ask for it. Verify it responds: `curl -sI -o /dev/null -w '%{http_code}' <url>` (expect 2xx/3xx).

## 2. Init and write good metadata
Run `node "$CLI" init` (add `--kind` if detection is wrong), then edit `appdrop.json`:
- `name`: the user-facing name. `slug`: lowercase-dashes, permanent.
- `tagline`: one punchy line, max 120 chars.
- `description`: rich markdown written from the README and code: what it does, a bullet list of features, notable details (offline, no ads, permissions). For long text use `descriptionFile` (e.g. `appdrop/description.md`).
- `category` (pick one): Productivity, Utilities, Tools, Social, Entertainment, Games, Education, Health & Fitness, Finance, Music & Audio, Photography, Lifestyle, Travel, Developer Tools.
- `developer`: the owner's name. `accentColor`: the app's brand/theme color (`#rrggbb`).
- `visibility`: `public` unless told otherwise. Android needs `repo`; web needs `webUrl`.
- If a release contains several APKs, set `assetPattern` (e.g. `*-universal-release.apk`).
Check with `node "$CLI" publish --dry-run`. Unknown keys only produce warnings; see `appdrop.example.json` in the AppDrop repo.

## 3. Icon
Use a real square PNG, 512 px or larger when possible (max 4 MB; SVG is rejected, adaptive-icon XML/vector drawables cannot be uploaded).
- Android: `app/src/main/ic_launcher-playstore.png`, else fastlane `icon.png`, else the largest `mipmap-*/ic_launcher.png`. If only adaptive XML exists, render the foreground over the background color to a 512 px PNG (ImageMagick `magick`, or Android Studio "Image Asset" export), or ask the user. Save it e.g. as `appdrop/icon.png` and point `icon` at it.
- Web: the largest icon from the manifest or `public/` (icon-512.png, apple-touch-icon.png...).

## 4. Screenshots (3-8, portrait phone)
Store them in `appdrop/screenshots/` and list them in order under `screenshots` (max 12, each <= 4 MB, PNG/JPEG/WebP).
- **Web**: `node "$CLI" screenshot-web <https-url> --paths "/,/about,/settings"` (add `--dark --out appdrop/screenshots/dark` for dark variants). Pick the key routes; if content is behind login, ask for a demo route or use what is reachable. Look at the images (Read tool) and drop blank or broken ones.
- **Android**, in this order of preference:
  1. `adb devices` shows a device/emulator: `adb install -r <apk>`, launch with `adb shell monkey -p <applicationId> 1`, navigate the key screens (`adb shell input tap X Y`, `input swipe`, `input keyevent 4`; find coordinates with `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml`), and capture each with `node "$CLI" screenshot-android --name 01-home` (then 02-..., 03-...).
  2. Existing fastlane `phoneScreenshots` (init picks them up).
  3. Ask the user to provide screenshots.

## 5. Android release (skip for web apps)
1. Bump `versionCode` (must increase) and `versionName` in `app/build.gradle(.kts)`.
2. Build a **signed** release APK: `./gradlew assembleRelease` (output usually `app/build/outputs/apk/release/*.apk`). An unsigned APK cannot be installed.
   - Signing: keep a persistent keystore **outside the repo**, e.g. `~/.android-keystores/<app>.jks`, with credentials in `~/.gradle/gradle.properties` (e.g. `APP_STORE_FILE`, `APP_STORE_PASSWORD`, `APP_KEY_ALIAS`, `APP_KEY_PASSWORD`) read by `signingConfigs.release` and applied via `buildTypes.release.signingConfig`. Create it once with `keytool -genkeypair -v -keystore ~/.android-keystores/<app>.jks -alias <app> -keyalg RSA -keysize 2048 -validity 10000`. Never commit keystores or passwords.
   - Warn the user: losing the key or changing it later breaks in-place updates for friends (they must uninstall first). Back the keystore up.
   - If ABI splits yield several APKs, prefer a universal APK (`universal true` / name contains `universal`) or set `assetPattern`.
3. Write release notes in user-facing language from commits since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`) into a temp file such as `/tmp/notes.md`.
4. Commit, tag, push: `git add -A && git commit -m "Release vX.Y.Z" && git tag vX.Y.Z && git push && git push --tags`. Make sure the working tree is clean first, and that `appdrop/` and the keystore are handled sensibly (screenshots may be committed; secrets never).
5. `node "$CLI" release --tag vX.Y.Z --apk <path-to-apk> --notes-file /tmp/notes.md` (creates the GitHub release, or re-uploads if the tag has one, then syncs). Needs `gh auth status` to pass.

## 6. Publish and verify
```bash
node "$CLI" publish        # metadata + icon + screenshots + sync
node "$CLI" status         # latestVersion must match the tag you released
```
Report to the user: store page URL, direct download URL (Android), latest version, visibility. If visibility is not `public`, say how to change it.

## 7. Updating later
New version: repeat step 5 (the `release` command syncs by itself). Run `publish` again only when metadata, icon or screenshots changed (it replaces all screenshots with the list in `appdrop.json`).

## 8. Troubleshooting
- **Sync error "Repository not found or token lacks access"** (or HTTP 404 on publish): the server's fine-grained `GITHUB_TOKEN` doesn't include this repo. Tell the user: GitHub, Settings, Developer settings, Fine-grained tokens, edit the AppDrop token, Repository access, add the repo (Contents + Metadata read-only), then re-run `publish`. The token lives in the server's env, so they may also need to update it there if it was regenerated.
- **401**: wrong API key; re-run `login` or fix `APPDROP_API_KEY`. **404 "Publishing API is disabled"**: the server has no `APPDROP_API_KEY` set. **429**: wait and retry.
- **422 / "appdrop.json has problems"**: fix the listed fields (slug format, tagline length, https webUrl, accentColor hex...).
- **No APK found / latestVersion empty**: the release has no `.apk` asset, is a draft, is a prerelease (set `includePrereleases`), or `assetPattern` doesn't match its filename.
- **Chrome not found** for screenshot-web: install Chrome/Chromium or set `CHROME_PATH`.
