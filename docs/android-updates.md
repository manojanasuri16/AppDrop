# In-app updates and feedback for Android apps

`android/AppDropUpdater.kt` is a single drop-in Kotlin file (no third-party libraries, min SDK 24) that:

- asks AppDrop for the latest release (at most once per 12 hours) and shows an "Update available" dialog with release notes (buttons: Update / Later / Skip this version),
- downloads the APK with the system DownloadManager, verifies its SHA-256, and opens the system installer,
- opens the app's feedback form, or posts feedback directly from your own UI.

## Install (once per app)

Fastest: from the app's project root run `node ~/AppDrop/scripts/appdrop.mjs add-updater` (or `appdrop add-updater`). It copies the files, rewrites the package, and prints the snippets below with your slug filled in. Manual route: copy the files from `android/`:

| File | Destination |
| --- | --- |
| `AppDropUpdater.kt` | `app/src/main/java/<your/package>/appdrop/AppDropUpdater.kt` (change the `package appdrop` line to match) |
| `res/xml/appdrop_file_paths.xml` | `app/src/main/res/xml/appdrop_file_paths.xml` |
| `MANIFEST_SNIPPET.xml` | not copied: apply its contents to `AndroidManifest.xml` |

The manifest needs `INTERNET`, `REQUEST_INSTALL_PACKAGES` and a `FileProvider` with authority `${applicationId}.appdrop.fileprovider` (see the snippet). FileProvider comes from `androidx.core`; if your app lacks it add `implementation("androidx.core:core-ktx:1.15.0")`.

## Wire it up

```kotlin
// Application.onCreate()  (create an Application subclass and set android:name if you have none)
AppDropUpdater.init(this, "https://appdrop-store.vercel.app", "<slug>")

// Main/launcher Activity
override fun onResume() { super.onResume(); AppDropUpdater.check(this) }
```

Optional menu or settings entries:

```kotlin
AppDropUpdater.check(this, force = true)   // "Check for updates": ignores the 12 h limit, says "You're up to date"
AppDropUpdater.openFeedback(this)          // opens {base}/apps/<slug>#feedback in the browser
AppDropUpdater.sendFeedback(ctx, "Great app", name = null, contact = null) { ok, error -> /* main thread */ }
```

`check()` is cheap, so calling it from `onResume` is fine. It never throws; failures are logged under the tag `AppDrop`.

## Versioning must match release tags

The server compares the installed `versionName` with the latest release tag after stripping a leading `v`: `versionName = "1.4.0"` pairs with tag `v1.4.0`. Use plain dotted numbers, bump on every release, and keep `versionCode` increasing (Android refuses to install a lower code). If these drift, users see a perpetual or missing update prompt.

Updates install over the existing app only if the new APK is signed with the same key as the old one.

## Beta testers

Call `AppDropUpdater.setBetaToken("<invite token>")` (e.g. from a hidden setting) before `check()`. With a valid AppDrop beta token, pre-releases count as the latest version for that user.

## Privacy

The only data sent is the app slug, installed `versionName`, and a random UUID generated on first run and stored in the app's private preferences. The server stores only a hash of it, to count active devices per version anonymously. Feedback is sent only when the user submits it.

## Troubleshooting

- **Nothing happens**: filter logcat by `AppDrop`. Check `init()` ran, the slug is right, and `versionName` is lower than the latest release tag. `check()` is throttled to 12 h; use `force = true` or clear app data while testing.
- **Dialog never offers an update**: the release has no APK asset, is a pre-release (needs a beta token), or is the version the user chose to skip.
- **"Allow installing updates" prompt**: Android 8+ needs the user to allow this app to install apps once. After allowing it, return to the app and the install continues.
- **FileProvider crash ("Failed to find configured root")**: the authority must be exactly `${applicationId}.appdrop.fileprovider` and the paths XML must be the supplied one.
- **"App not installed" at the end**: the new APK is signed with a different key or has a lower `versionCode`.
- **Checksum mismatch message**: the download was corrupted; try again. The APK is deleted and not installed.
