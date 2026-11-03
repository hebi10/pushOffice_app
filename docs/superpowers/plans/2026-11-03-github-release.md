# Push Office GitHub build and privacy publication

The user requested the GitHub approach used by `hebi10/quickcut`, supplied `asdlkj0104@gmail.com` as the public support email, and requested a new privacy policy. This authorizes publishing the app changes/build configuration and policy to the existing public Push Office repository, and saving those details in the existing Play Console draft. EAS hosting/login is not required; keep the Expo framework and build the generated Android project in GitHub Actions.

1. Inspect the reference workflow and the actual Push Office repository settings. Preserve app-specific signing identity; never use QuickCut's private key or create a replacement upload key silently.
2. Add a manually triggered/main-branch Android build with normal JS checks and Gradle `bundleRelease`. Strip inherited debug JAR signatures. With all existing-key secrets present, verify the pinned certificate and produce a signed AAB; with none present, produce an explicitly unsigned artifact; partial secrets must fail.
3. Write a source-backed Korean privacy policy in `docs/privacy/index.html`, with the approved public support email. Publish through GitHub Pages and verify the public URL before adding it to Play Console.
4. Save the support email and policy URL to the existing store draft. Do not accept IARC legal terms without the required action-time confirmation.
5. Publish tested source/configuration to GitHub and check the workflow result. Upload a Play-acceptable AAB only after the actual existing upload key is available and certificate matching is verified. Report pending credentials accurately.

## Initial evidence

- QuickCut's release workflow builds in GitHub Actions and supports either signed output with four app-specific secrets or unsigned offline preparation. It does not itself upload to Play.
- Push Office `main` is unprotected at `a34c8912dcb2a85caaa27bb199c1a111e7e13594` as inspected on 2026-11-03.
- Push Office repository and environment secret lists are empty. GitHub Pages is disabled.
- A code-3 unsigned AAB was already validated locally. The generated source AAB was Android-debug-signed and must never be uploaded as the release.

## Validation

Run CI tooling tests, app tests/type checks/lint, review the workflow and policy, verify GitHub's committed files/run state and public policy response, and inspect saved Console fields. Keep the existing production rollout restriction and legal-agreement handoff separate from routine metadata saves.
