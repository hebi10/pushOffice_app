# Push Office Android local module

Expo SDK 54 automatically discovers this app-local module in `modules/`; `expo-modules-autolinking search --platform android` confirms registration. Do not add this directory to `node_modules` or manually edit generated package lists.

The app must use Android minSdk 26 (set `android.minSdkVersion=26` with the app's Expo config/build-properties workflow). The module manifest merges notification, boot, and exact-alarm permissions; Android 13 notification permission must be requested by the app UI. `configure` returns actual notification permission and exact/inexact alarm capability so settings can disclose timing limitations.

## Shared native entry points

- `ScheduleStore(context).use { it.all() / it.get(id) }` reads durable SQLite records. `startAt` is the original recurrence anchor and never advances after an alarm; its original zone is retained internally.
- `ScheduleRuntime.save(context, record)` and `ScheduleRuntime.delete(context, id)` validate/commit and update alarms plus `SCHEDULES_CHANGED` broadcasts. Native confirmed entry must use these helpers. `ScheduleStore.addListener` supplies in-process mutation events to the Expo bridge; widget providers should listen for `ScheduleRuntime.ACTION_CHANGED`.
- `ScheduleSerial.withLock` serializes mutation, configure/import, alarm reconciliation, recovery and delivery across native callers.
- `ReminderScheduler.rescheduleAll()` recovers alarm reservations. Unchanged due reservations keep their occurrence/token; stale edited/deleted/disabled deliveries are rejected against persisted record/config fingerprints and occurrence tokens. `snooze(id, minutes)` creates an actual persisted alarm; `cancelSnooze(id)` cancels it. Default notification snooze action is ten minutes.
- `importSchedules` validates all supplied records first and inserts only missing IDs, preserving historical records and any existing local edits. Legacy imports should be marked completed by their caller, so a user-deleted legacy record is not offered for import again on each launch.

`PushOfficeNative` exposes typed Promise APIs and `schedulesChanged`. Unsupported platforms import safely; writes reject with a clear capability message. There is no network code or credential requirement.

## Verification

`python /workspace/scratch/a7f1e63aed56/tooling/run_gradle.py :push-office-native:testDebugUnitTest` runs native JUnit tests through the app's generated Android project. The pure date/validation tests can also be compiled with Gradle's bundled Kotlin compiler and run with its bundled JUnit 4 jars, without loading Android classes.

## Capture, tile, widgets and Nano

- `openQuickEntry()` opens a compact native chooser. Text and voice editors show editable transcripts and explicit save previews; opening a voice editor never starts the microphone. The on-device recognizer is used exclusively. API33+ checks installed Korean recognition support and can request an actual language-model download; API31–32 cannot verify Korean installation and retain text entry.
- `requestAddTile()` resolves the actual Android callback (`added`, `already_added`, `not_added`, `error_<code>`). Before API33 it shows placement instructions and returns `unsupported_manual`. Tile clicks unlock first; API34+ uses the required `PendingIntent` API.
- `requestPinWidget('small' | 'agenda')` displays the launcher's normal pin request. Its boolean only means the request was accepted; placement still depends on the user's launcher confirmation. Widgets query the shared SQLite store, retain original recurrence zones/anchors and refresh on committed mutations, periodic widget updates, boot and time/date/timezone changes. Details dispatch `pushofficeapp://schedule/<id>` to the app route.
- `getAiStatus()` distinguishes available/downloadable/downloading/unavailable/error. `generateBriefing(prompt)` requires an active app window. Nano uses ML Kit `genai-prompt:1.0.0-beta5` with validated JSON, no KSP and no network fallback. Its transitive Kotlin 2.4.0 metadata requires the host's `android.kotlinVersion=2.4.0` Expo configuration; suppressing metadata checks is not supported.
- Native edits always select a matching persisted record and show before/after. A global-lock re-read rejects stale previews. Deterministic parsing/manual date/time editing remains usable on devices without AI Core or Korean recognition.

`NativeSchedule.anchorZone` is optional on incoming legacy/new records and always returned on persisted records. It must be an IANA zone identifier when supplied. New records use the incoming zone, then a valid configured app timezone, then device timezone. Existing-id edits preserve the canonical stored zone even when their start time changes; no implicit travel-driven recurrence-zone changes occur. Native edit previews show and parse the record's zone. Batch imports use one SQLite transaction, preserve existing ids and emit mutation events/reschedule only after successful commit.
