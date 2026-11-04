# Push Office Play automation

The user requests APK/AAB builds and Google Play delivery through GitHub Actions. Changes to `main` deploy to internal testing. Closed testing requires an explicit manual selection; production and open testing are outside scope.

Reuse Expo SDK 54, Node 22, Java 17, Gradle, the existing AAB verifier and the existing five `PUSH_OFFICE_*` signing settings. Sign both APK and AAB with the approved upload certificate `7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845`. Upload only the AAB to Play. APKs are installation artifacts and cannot update Play-signed installations.

Reuse the existing Workload Identity Federation variables `PLAY_WORKLOAD_IDENTITY_PROVIDER` and `PLAY_SERVICE_ACCOUNT` for `play-pushoffice@hebi-app-release-80847404.iam.gserviceaccount.com` in project `hebi-app-release-80847404` (973619009476). No JSON service-account key or new cloud account is needed.

Approaches: extending the existing native Gradle workflow preserves its proven build and signature verification. Adding Fastlane or EAS would duplicate build/authentication infrastructure, so use a small Python standard-library Play edits client instead. This implementation choice follows the existing release tooling.

Serialize releases for this package across all triggers. Query bundles, APKs and every track before choosing a new versionCode. Resolve the internal API alias (`qa` or `internal`) from actual inventory. Closed deployments require an exact existing closed track; never create or guess one. Recheck inventory before upload to reject external version races. Preserve unrelated tracks and reject nonempty draft/halted/in-progress target releases.

Authenticate once for preflight, and obtain a fresh short-lived publisher token after the build. Never retry uncertain upload/commit mutations automatically. Confirm uploaded version/hash and read the committed target track in a fresh edit before claiming API release acceptance. Google review/availability remain separate from API acceptance.

Manual modes: `check` validates Play connection without uploads, `build` produces signed APK/AAB without publishing, and `deploy` builds and publishes the selected test track. Default is deploy/internal. Before 2026-11-06T03:32:00Z, successful signed builds are retained and Play upload is explicitly deferred because the approved key is not active. No new scheduled tasks are created.

Repository credentials and current browser sessions may prevent completing live setup. Implement and test the full pipeline first, then report the exact remaining connection or signing setting without exposing private values.
