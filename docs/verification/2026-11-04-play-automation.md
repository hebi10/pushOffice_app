# Push Office Play automation verification

The user authorized APK/AAB builds, default internal-test delivery and manually selected closed tests through GitHub Actions. The existing Hebi App Release WIF account is reused; no service-account JSON key, replacement account or new upload key was created.

## Verified locally

- Python release tests: 75 passed. These cover track resolution and forbidden destinations, version inventory/races, empty and nonempty drafts, upload integrity, uncertain commit state, cleanup, certificate guards, metadata and release policy.
- Four actual workflow Bash command/target combinations were exercised with a CLI shim. Internal mode omits `--closed-track` even if a closed-track variable is configured; explicit closed mode forwards it.
- Existing application tests: 50 passed. TypeScript and ESLint passed, with existing npm configuration warnings.
- The portable AAB signer was exercised on the real three-ABI bundle with the already supplied upload key; bundletool, certificate and signature validation passed.
- The portable APK signer was exercised on the delivered real three-ABI APK with the same key. The final v2 single signer, approved certificate, ZIP/ELF 16 KB alignment and unchanged application payloads passed. Each ABI contains 23 native libraries.
- Independent review found one workflow argument integration issue; it was corrected and the four command combinations passed. No further blocking issue was found.
- No application/UI changes or dependency additions were made.

## Signing recovery

The previous cloud-keystore investigation found a certificate different from the old Play upload certificate. The supplied key with approved fingerprint `7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845` has already passed real signing checks. Play accepted the upload-key reset request on 2026-11-04; activation is **2026-11-06 12:32 KST**. The pending request must not be replaced with another unnecessary key/reset.

A metadata search of the known PushOffice Drive folder (`PushOffice-Play-1.1.0`) found store artwork/screenshots, not a separate original keystore backup. This is a scoped check, not a claim that every possible backup source was searched.

## Live setup and remaining checks

The current `Hebi-App-Release-Setup-2026-11-04.json` records the existing project/provider, app-specific service account and repository WIF variables. Workflow authentication uses those existing variables and refreshes its token after the build.

The four private `PUSH_OFFICE_*` signing Secrets must be present before an actual Actions build can proceed. This session has the supplied key locally but cannot register the Secrets while the originating browser connection is unavailable. Values were not printed or committed. The approved public certificate pin is fixed in the workflow rather than using the old pin Secret.

The first main-branch run (41795858564) passed all 69 then-current tests and successfully authenticated the existing WIF app account. Play preflight encountered a valid track identifier outside the initial ASCII assumptions. Inventory now accepts printable server IDs (including localized/space names); exact selected track names use canonical UTF-8 path encoding. Six regression tests and a scoped independent review passed. Follow-up run [41796673910](https://github.com/hebi10/pushOffice_app/actions/runs/41796673910) passed all 75 release tests, existing WIF authentication, Play track inventory and versionCode allocation. It then stopped before building because all four private signing Secrets were absent: PUSH_OFFICE_KEYSTORE_BASE64, PUSH_OFFICE_KEYSTORE_PASSWORD, PUSH_OFFICE_KEY_ALIAS, PUSH_OFFICE_KEY_PASSWORD. Thus Actions Gradle/signing and Play upload have not completed; local real-key signing did pass. Before key activation, a successful signed build is explicitly deferred rather than published. Google review/tester availability is separate from an accepted API edit.


## Follow-up source and version guards

The follow-up audit preserved the existing release workflow and the separate UI refresh PR. Publication now requires the verification report's source commit to equal the current workflow `GITHUB_SHA`; its actual AAB package, version name and versionCode must also match the effective checkout `app.json` used for that build. Missing, malformed or different source context and stale version/package files fail before any Play API request.

- Three new regression tests (seven rejection cases) first demonstrated the previous acceptance behavior, then passed with the guards in place. All 78 Python release tests passed.
- Existing app tests: 50 passed; TypeScript and ESLint passed. Locked public dependencies were installed without lifecycle scripts. Existing npm configuration/deprecation warnings remain.
- Both release workflows passed actionlint and the patch passed `git diff --check`.
- `Push Office release tool checks` validates release-tool changes in pull requests with read-only contents permission, without Play authentication or signing Secrets.
- No application code, source version, upload key, repository signing settings, Play release, UI refresh changes or activation date was changed by this follow-up. A new signed Actions build and Play upload were not run as part of this audit. The historical missing-Secret failure and future key-activation requirement above remain unresolved until checked separately.
