# Native entry design verification — 2026-11-04

Scope: the two Android home-screen widgets, the Quick Settings tile label/subtitle, and the native text/voice input chooser. The editor, confirmation flow, local storage, package identity and version remain unchanged (`com.hebi96.pushOffice_app`, 1.1.0 / code 3).

## Implemented behavior

- Widgets keep event rows and input actions together when resized. The next-event widget separates date/time from title; agenda capacity adapts to available height. Text and voice actions retain 48 dp touch targets.
- The Quick Settings tile and add-tile instructions use the app name, Push Office. Android 10 and later also show a text/voice subtitle.
- The chooser provides two descriptive input actions, a compact close action and a scrollable window capped at 400 dp. Opening voice entry still waits for an explicit recording start.

## Verified checks

| Check | Outcome |
| --- | --- |
| `npm test` | 50 passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; existing npm configuration warnings only |
| Native `testDebugUnitTest` | 31 passed, no failures/errors |
| Current native test APK build | Passed with Gradle 8.14.3 / Java 17 |
| Full default-font native instrumentation | 16 passed after recovery of the emulator system dialog; assertions unchanged |
| 2×-font chooser group | 4/5 passed; voice active-window accessibility root was transiently unavailable |
| Isolated 2×-font voice check | 1/1 passed with unchanged assertions |
| Tablet 2×-font chooser width/scroll check | 1/1 passed at 1440×2560 / 280 dpi (~823 dp minimum width) |
| Widget instrumentation | All 7 widget tests passed, including normal/2× text, 110 dp height, portrait/landscape dimension pairs, default/empty data and click destinations |

The first current-source full instrumentation run completed 15 of 16 tests successfully. Its sole failure was the voice editor's active-window assertion (`active=android`). Inspection immediately after the failure found an Android system dialog titled **System UI isn't responding**, owned by `com.android.systemui`, rather than an app or microphone-permission dialog. The assertion was retained. The system dialog, window dump and exact test log were preserved before recovery of the isolated emulator.

The unchanged full default-font suite passed **16/16** after dismissing the observed SystemUI dialog. In the 2×-font chooser group, four tests passed and the voice test could not observe the active accessibility root. A targeted run of that same voice test then passed **1/1**, including the recording safeguard, unchanged microphone permission and app/keyboard active-window assertions. The grouped failure is retained as a software-emulator/accessibility timing limitation; it is not reported as a clean five-test group. The tablet 2×-font chooser width/scroll check passed **1/1**. The original 1600×2560 request was clamped by this emulator to 1440×2560; the final check explicitly used that supported size (~823 dp width). Final release screenshots are pending the release build.

## Environment and limits

The tests use an isolated Android 10 / API 29 x86_64 software emulator at 720×1600, 280 dpi. Native widget measurements additionally exercise 1×/2× font configurations and both orientation variants. The large-font input-action/scrolling checks passed. The tablet width/scroll check passed at ~823 dp minimum width; the chooser remained capped at 400 dp and its close action stayed reachable. Display/font overrides were restored after each run. Android 14+ tile launch behavior and physical-device behavior have not been runtime-tested in this session; the existing API-specific launch path was preserved.

The previous signed AAB predates this native UI change. Final release artifacts and Play upload status must be checked independently; a successful local UI check does not establish Play publication.

## Source and evidence

All native source and test files remained unchanged during this recovery/validation session. The tested native APK SHA-256 is `eb4a85b7a9da5dd53998bb728acaeac9bef546cd43aeecec3fe8d8a074466b57`. The successful 16-test, isolated voice and tablet checks are recorded separately; the failed grouped large-font attempt was preserved, not overwritten.
