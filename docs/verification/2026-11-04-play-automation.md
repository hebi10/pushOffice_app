# Push Office Play automation verification

The user authorized APK/AAB builds, default internal-test delivery and manually selected closed tests through GitHub Actions. The existing Hebi App Release WIF account is reused; no service-account JSON key, replacement account or new upload key was created.

## Verified locally

- Python release tests: 69 passed. These cover track resolution and forbidden destinations, version inventory/races, empty and nonempty drafts, upload integrity, uncertain commit state, cleanup, certificate guards, metadata and release policy.
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

The first main-branch workflow run will separately establish live WIF/Play connectivity and actual signing-setting availability. Until that run is observed, this record does not claim live Actions signing or Play upload success. Before key activation, a successful signed build is explicitly deferred rather than published. Google review/tester availability is separate from an accepted API edit.
