# Push Office local assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship a working local schedule assistant with compact text/voice entry, a Quick Settings tile, two widgets, dependable schedule reservations, and morning briefing.

**Architecture:** Keep Expo SDK54 app screens. Add a local Kotlin Expo module with SQLite persistence shared by native entry, widgets, alarms, and the TypeScript schedule adapter. Gemini Nano is an optional foreground helper with honest device status and deterministic fallback.

**Tech Stack:** Expo54, React Native 0.81, TypeScript, Redux Toolkit, TanStack Query, Kotlin, Android SQLite/AlarmManager/RemoteViews, ML Kit genai-prompt beta5.

**Spec:** docs/superpowers/specs/2026-11-03-local-assistant-design.md

## Global Constraints

- Preserve package `com.hebi96.pushOffice_app`; work on `feat/local-schedule-assistant`, never push or publish.
- Keep Expo SDK54; Android module minSdk26. No full platform rewrite.
- Tile opens a text/voice chooser; no automatic or continuous microphone capture.
- Local schedule data is the common source for app, entry, widgets and reminders. No silent cloud speech/AI fallback.
- Preserve existing data, idempotent import, validate before confirmed saves, and cancel/rebuild actual alarms on mutations.
- Use real emulator captures; label sample data and unverified real-device capabilities honestly.

## Review Focus

- Month-end/leap-day repeated events retain their original day anchor across successive occurrences.
- Invalid calendar dates, absent dates and ambiguous target edits do not silently change data.
- Disabling, rescheduling, deleting and rebooting do not leave stale or duplicate alarms.
- Widget/quick-entry mutations are visible to a resumed React Native screen without restarting it.
- Missing Firebase configuration, offline speech or Nano availability never prevent basic local use.

---

### Task 1: Shared native local persistence and reminders

**Files:** create `modules/push-office-native/{package.json,expo-module.config.json,index.ts,android/build.gradle}`, Kotlin files under `android/src/main/java/expo/modules/pushoffice/`, manifest/resources and native unit tests. Do not modify app screens.

**Interfaces:** Produce `NativeSchedule` and `PushOfficeNative` methods getSchedules, saveSchedule, deleteSchedule, configure; emit schedulesChanged. Native classes ScheduleStore, ScheduleRecord, ScheduleTime and ReminderScheduler expose reusable methods for Task2. Settings passed through configure include pushEnabled, dailyBriefingEnabled, dailyBriefingTime, timezone.

- [x] Add failing pure Kotlin tests for monthly Jan31→Feb28→Mar31, yearly leap-day anchor, past one-shot rejection, end before start rejection, and deterministic PendingIntent identity.
- [x] Run tests and record expected failures; implement SQLite CRUD and validation. Store original recurrence anchor, calculate next occurrence without destructive date shifts.
- [x] Implement native reminders, snoozes and morning briefing alarm receivers. Reserve by stable event identity; cancel on disable/delete; recover on BOOT_COMPLETED/TIME_SET/TIMEZONE_CHANGED. Use exact alarms only when allowed, supported inexact fallback otherwise.
- [x] Add Expo bridge and TypeScript record contract; no credentials required. Include a guarded platform fallback for non-Android imports.
- [x] Run native tests/build when environment is ready, review diff and commit only Task1 files.

### Task 2: Compact capture, local AI, tile and widgets

**Files:** extend Task1 native module with `QuickEntryActivity.kt`, `ScheduleParser.kt`, `NanoClient.kt`, `ScheduleTileService.kt`, `ScheduleWidgetProvider.kt`, layouts/widget metadata/drawables, tests, and required bridge methods. Keep app screens for Task3.

**Interfaces:** Consume Task1 store and scheduler. Produce openQuickEntry(), requestAddTile(), requestPinWidget(kind: 'small' | 'agenda'), getAiStatus(), generateBriefing(prompt). Expose `pushofficeapp://schedule/<id>` deep links for widget details; native entry uses the common store directly. Widget pinning uses the normal Android launcher confirmation.

- [x] Add failing tests for Korean relative date/time input, missing/invalid date, monthly/yearly parsing, a shift request, and multiple matching targets; test behavior rather than UI implementation strings.
- [x] Build compact text/voice chooser, editable transcript and confirmation preview. On-device speech checks Korean readiness; unsupported recognition offers text/download guidance, never online fallback. Microphone starts only after explicit tap and stops on pause/exit.
- [x] Integrate `com.google.mlkit:genai-prompt:1.0.0-beta5` with availability and errors distinguished. Use explicit current date/timezone, require parseable validated output; fall back to deterministic parser/manual entry. AI refinement must not silently change existing data.
- [x] Add tile (unlock, PendingIntent API34 branch) and system tile-add request; add small/agenda native RemoteViews widgets with entry buttons and event links, mutation/time/boot refresh. Widgets must use persisted schedules rather than JS memory.
- [x] Native tests/build, self-review and commit Task2 files.

### Task 3: React Native local integration and product screens

**Files:** modify `src/features/{auth,schedules,notifications,storage,digest}`, types, `app/{_layout.tsx,(tabs)/index.tsx,(tabs)/calendar.tsx,(tabs)/settings.tsx,schedule/[id].tsx}`, `app.json`, tests and README as needed. Keep unrelated server code intact.

**Interfaces:** Consume PushOfficeNative records/configuration and schedulesChanged event. Retain ScheduleDoc and existing query-hook signatures; hydrate Timestamp accessors only at adapter boundary. App mutations delegate to native store/scheduler. Configure updates native briefing/push settings.

- [x] Add meaningful failing tests for record hydration, local-mode operation without Firebase keys, idempotent legacy import and occurrence projection into monthly views.
- [x] Default fresh installs to local mode; do not initialize invalid Firebase Auth. Preserve configured legacy Firebase schedules through explicit idempotent local import, without remote writes/deletes.
- [x] Wire local CRUD/query identity, resume/event invalidation and accurate notification state. Connect quick-entry buttons from app/calendar, shared record details, and native snooze/configuration methods.
- [x] Home shows today's schedule summary, next event, text/voice entry, optional local AI summary with honest loading/unavailable state. Settings offers tile addition, widget guidance, local AI readiness, speech and notification information without blocking local use. Keep existing optional external briefing settings.
- [x] Run project typecheck/lint/test suite, self-review and commit Task3 files.

### Task 4: Build, emulator acceptance and delivery

**Files:** verification notes and README only; any production defects return to owning implementer and review.

- [x] Produce Expo prebuild and a standalone emulator APK (release variant with debug signing) with minSdk26, install on real Android emulator.
- [x] Exercise new record preview/save, ambiguous edit, time change, relaunch persistence, tile entry, widget display and refresh. Inspect runtime crash logs.
- [x] Capture real app home/calendar, compact chooser/preview, Quick Settings tile and home widget; disclose demonstration data and hardware-only AI/speech limits.
- [x] Save requested screenshots, record verification evidence, finish with all commits retained locally and no push/release.

## Completion evidence

Implementation retained on `feat/local-schedule-assistant`; no push or publication. Native implementation and screenshots were verified on the installed `2fab494` APK. The final `5f10fd0` cold Settings-link guard was verified by a failing-then-passing regression, the full 50-test Node suite, TypeScript, ESLint, and an independent scoped review; it is not represented as installed emulator evidence. Native unit tests (31) and SQLite/Intent instrumentation tests (4) passed on the unchanged native code. See `docs/verification/2026-11-03-android-assistant.md` for evidence and physical-device limitations.
