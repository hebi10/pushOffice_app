# Push Office local assistant

Approved scope: the user requested implementation of the discussed local schedule assistant, Quick Settings entry, home-screen widgets, morning briefing, and actual emulator screenshots. The tile opens a compact window with text and voice choices; it never starts recording automatically.

## Product behavior

- Keep the existing Expo/React Native app and Korean calendar/settings screens.
- Use a durable on-device schedule store shared by the app, native quick entry, widgets, and alarm receivers. Existing Firebase/local records must remain recoverable and import idempotently; no remote deletes or uploads without a user action.
- Quick entry supports text and explicit on-device Korean speech recognition. Show the transcript, a validated preview, and a save confirmation. Modification requests identify the target and show before/after; ambiguous targets require selection. Invalid/missing dates and times cannot silently save.
- Use Gemini Nano when actually available while the input activity is foreground. Always keep deterministic parsing/manual editing usable when unavailable. Never simulate AI availability or silently send speech or schedule text to a cloud service.
- A Quick Settings tile opens the compact native input activity after unlocking. Offer the system add-tile request from settings. Users place the tile themselves.
- Provide small and agenda home-screen widgets showing next/today schedules with text/voice-entry buttons and links to the same input screen. Mutations refresh widgets; boot, time/date/timezone changes restore alarms and widget data.
- Schedule notifications and daily morning briefing with Android's scheduler independently of AI. Time edits, enable/disable, deletion, recurrence and snoozes update real reservations. If exact alarms are unavailable, use the supported inexact path and disclose that timing can vary.
- Morning briefing uses actual locally stored schedules; show a deterministic useful summary immediately and optional foreground Nano refinement. Existing external weather/news/stock features remain optional and do not block local use.
- Screenshots must come from the installed running app, native quick entry, tile, and actual home widget. Sample events may be entered through the UI and clearly identified as demonstration data.

## Architecture

Retain Expo SDK54 and add an app-local Kotlin Expo module, `push-office-native`. Standard SQLiteOpenHelper supplies the durable schedule store; native AlarmManager receivers and RemoteViews widgets avoid depending on a running JS process. Native UI uses existing Android APIs and the app's blue/neutral visual direction. TypeScript adapters retain existing ScheduleDoc consumers and Firebase Timestamp-shaped accessors at their boundaries.

Alternative considered: rebuilding the whole app in Kotlin. It would discard usable screens and increase migration work. Expanding Expo with the necessary native module is the chosen implementation judgment under the user's instruction to apply the plan.

## Native bridge contract

`NativeSchedule`: id, userId, type, title, startAt (epoch milliseconds), endAt (nullable epoch milliseconds), isAllDay, repeatType (none/monthly/yearly), notificationEnabled, notificationId (nullable string), sourceText, createdAt, updatedAt.

`PushOfficeNative`: getSchedules(), saveSchedule(record), deleteSchedule(id), configure(settings), openQuickEntry(), requestAddTile(), getAiStatus(), generateBriefing(prompt). Emit `schedulesChanged` after committed mutations. All data is local; remote sync is an explicit optional existing mode.

## Validation

Unit-test date parsing/validation, month-end and leap-year recurrence, mutation/alarm identifiers, and modification ambiguity. Type-check and lint the app; compile native unit tests and a debug APK. Run actual emulator checks for create/edit/relaunch persistence, input chooser, widget refresh, tile entry, and notification scheduling. State explicitly that Nano and microphone recognition require compatible real hardware if unavailable in the emulator.
