# Push Office Play automation Implementation Plan

**Goal:** Build signed APK/AAB artifacts and automatically release internal tests, with explicit manual closed testing.

**Architecture:** Extend the current native GitHub Actions workflow with existing WIF authentication, inventory-based version allocation, isolated signing, verified Play edits and final track readback.

**Tech Stack:** Python standard library, GitHub Actions, Expo/Gradle, Java 17, Android build-tools 36.

**Spec:** `docs/superpowers/specs/2026-11-04-play-automation-design.md`

## Global Constraints

- Existing package `com.hebi96.pushOffice_app`; SDK 26/36 and ARM64/ARMv7/x86_64.
- Existing upload key only; pin `7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845`.
- Main push defaults to internal. Closed testing is manual only. No production/open publishing.
- WIF through the existing app service account; no JSON account keys, secret logging or dependency additions.
- Preserve application code and UI. No real Play upload before 2026-11-06T03:32:00Z.

## Review Focus

- Draft or reused version codes must fail safely, including an external Console upload during a build.
- Missing secrets or the old certificate pin must never produce an unsigned deployable artifact.
- Ambiguous internal aliases or reserved closed track identifiers must not publish elsewhere.
- Failed hash/version verification or uncertain API mutations must never be retried or reported as success.
- Tokens and signing values must stay out of outputs, artifacts and subprocess errors.

### Task 1: Play edits client and version allocation

Files: `tools/ci/play_publish.py`, `tools/ci/test_play_publish.py`.

- [ ] Test inventory, internal alias resolution, closed validation, code allocation, empty/nonempty drafts, artifact provenance, upload/commit failures and verification cleanup.
- [ ] Implement `preflight` and `publish` CLI with injectable transport and safe errors. Consume `PLAY_ACCESS_TOKEN`, selected target/closed track and matching verified AAB report. Produce JSON report and GitHub outputs without credentials.
- [ ] Run tests and independent review.

### Task 2: Portable verified APK signing

Files: `tools/ci/release_apk.py`, `tools/ci/test_release_apk.py`.

- [ ] Test APK metadata/ABI/pin guards and signature rejection before signing implementation.
- [ ] Reuse existing AAB validation helpers; verify APK v2 signature, single signer, pinned certificate, 16KB alignment and unchanged payloads. Require complete existing signing secrets. Produce artifact/report paths and hashes.
- [ ] Validate against the already built real three-ABI APK with approved local credentials without logging secrets.
- [ ] Run tests and independent review.

### Task 3: Workflow, release policy and documentation

Files: `.github/workflows/android-release.yml`, `tools/ci/release_policy.py`, `tools/ci/test_release_policy.py`, `tools/ci/README.md`.

- [ ] Test event/branch/mode selection, activation gate, effective version configuration and old-pin rejection.
- [ ] Wire tests, WIF preflight, inventory versionCode allocation, native APK/AAB build, signing, artifacts, fresh WIF token and verified Play publish. One global concurrency group, explicit main-only permissions and post-build deferred notice before activation.
- [ ] Review all changes, run CI/app checks and locally verify actual APK/AAB paths. Push main and inspect the triggered run through available GitHub tooling.
- [ ] Record live auth/signing blockers accurately. Finish all available code work before requesting the unavailable browser connection.
