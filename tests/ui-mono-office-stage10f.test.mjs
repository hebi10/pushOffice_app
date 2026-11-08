import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const calendar = read('app/(tabs)/calendar.tsx');
const settings = read('app/(tabs)/settings.tsx');
const detail = read('app/schedule/[id].tsx');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');
const workflow = read('.github/workflows/ui-native-instrumentation.yml');
const run = read('tools/ui/run_mono_office_native_qa.sh');
const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const widgets = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleWidgetViews.kt');

test('10-F retains all four screens and existing schedule/notification/AI actions', () => {
  for (const [file, required] of [
    [home, ['title="다음 일정"', 'title="오늘의 브리핑"', 'PushOfficeNative.openQuickEntry()', 'PushOfficeNative.openVoiceQuickEntry()', 'PushOfficeNative.generateBriefing(', 'external.mutate(']],
    [calendar, ['markingType="multi-dot"', 'onDayPress={date => setSelected(date.dateString)}', 'title="해당 날짜의 일정"', 'schedules.isError']],
    [settings, ['saveAssistantSettings(patch)', 'PushOfficeNative.setNotificationCaptureEnabled(false)', 'PushOfficeNative.downloadAiModel()', 'PushOfficeNative.requestPinWidget(kind)', 'retryLegacyRecovery()']],
    [detail, ['await update.mutateAsync', 'remove.mutateAsync(id)', "visible={pendingDialog === 'delete'}", "visible={pendingDialog === 'repeat'}", 'PushOfficeNative.snoozeSchedule(id, 10)']],
  ]) for (const symbol of required) assert.ok(file.includes(symbol), symbol);
});

test('10-F screenshot suite covers real dark native surfaces and 57-screen responsive QA', () => {
  assert.match(capture, /assert_native_mono_surface\("11-quick-entry-dark", 100, 1000\)/);
  assert.match(capture, /assert_native_mono_surface\("12-native-editor-dark", 100, 500\)/);
  assert.match(capture, /expected = \(28, 31, 34\)/);
  assert.match(capture, /"settings", "put", "system", "font_scale", "1\.3"/);
  assert.match(capture, /"wm", "size", "1440x2160"/);
  assert.match(capture, /"wm", "size", "640x1360"/);
  for (const name of [
    '01-home', '02-calendar', '03-settings', '11-schedule-detail',
    '10-home-dark', '02b-calendar-dark', '11a-schedule-detail-dark',
    '11-quick-entry-dark', '12-native-editor-dark',
    '20a-large-font-home', '20c-large-font-settings',
    '21a-tablet-home', '21c-tablet-settings',
    '22a-home-today-one', '22b-home-today-three',
    '23b-calendar-today-three', '23c-calendar-today-three-list',
  ]) assert.ok(verify.includes('"' + name + '.png"'), name);
  assert.match(verify, /widget_providers_registered/);
  assert.match(verify, /if warnings:/);
});

test('10-F native widget integration includes both widget sizes, 0-3 events, resize, font and intent checks', () => {
  assert.match(workflow, /reactivecircus\/android-emulator-runner@v2/);
  assert.match(workflow, /api-level: 29/);
  assert.match(workflow, /timeout-minutes: 80/);
  assert.match(run, /:push-office-native:connectedDebugAndroidTest/);
  assert.match(run, /ScheduleWidgetViewsTest,expo\.modules\.pushoffice\.QuickEntryActivityUiTest/);
  for (const symbol of ['eventIntent(context, event.id)', 'entryIntent(context, "voice")', 'setOnClickPendingIntent(R.id.widget_text', 'setOnClickPendingIntent(R.id.widget_voice']) {
    assert.ok(widgets.includes(symbol), symbol);
  }
  assert.match(native, /"dark" -> setTheme\(R\.style\.PushOfficeDialogDark\)/);
  assert.match(native, /"light" -> setTheme\(R\.style\.PushOfficeDialogLight\)/);
});

test('10-F release gate does not publish from a design PR', () => {
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /edits\.commit|publish-to-play|upload-aab|play-store/);
  assert.match(workflow, /permissions:\s+contents: read/);
});
