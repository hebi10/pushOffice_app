import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'modules/push-office-native/android/src/main/';
const manifest = read(root + 'AndroidManifest.xml');
const provider = read(root + 'java/expo/modules/pushoffice/ScheduleWidgetProvider.kt');
const widgets = read(root + 'java/expo/modules/pushoffice/ScheduleWidgetViews.kt');
const tile = read(root + 'java/expo/modules/pushoffice/ScheduleTileService.kt');
const recovery = read(root + 'java/expo/modules/pushoffice/ReminderReceiver.kt');
const scheduler = read(root + 'java/expo/modules/pushoffice/WidgetRefreshScheduler.kt');
const nativeTest = read('modules/push-office-native/android/src/androidTest/java/expo/modules/pushoffice/ScheduleWidgetViewsTest.kt');
const qa = read('tools/ui/run_mono_office_native_qa.sh');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('UI-11-06 retains both secure home widget providers and their refresh broadcasts', () => {
  for (const name of ['ScheduleWidgetProvider', 'ScheduleAgendaWidgetProvider']) {
    assert.match(manifest, new RegExp('android:name="\\.' + name + '" android:exported="false"'));
    assert.ok(provider.includes(name), name);
  }
  for (const name of ['BOOT_COMPLETED','TIMEZONE_CHANGED','DATE_CHANGED','MY_PACKAGE_REPLACED']) {
    assert.ok(manifest.includes('android.intent.action.' + name), name);
  }
  for (const phrase of ['getAppWidgetIds(', 'onAppWidgetOptionsChanged', 'ScheduleSerial.withLock',
    'WidgetRefreshScheduler.reserve', 'ScheduleWidgetViews.create(', 'ScheduleTime.nextOccurrence']) {
    assert.ok(provider.includes(phrase), phrase);
  }
  assert.match(scheduler, /AlarmManager\.RTC/);
  assert.match(recovery, /class ReminderRecoveryReceiver/);
  assert.match(recovery, /ScheduleRuntime\.changed\(context\)/);
});

test('UI-11-06 preserves 0-3 event, resize, entry clicks and distinct quick settings actions', () => {
  for (const phrase of ['events.take(rows.size)', 'if (agenda) listOf(', 'setOnClickPendingIntent(row,',
    'entryIntent(context, "text")', 'entryIntent(context, "voice")', 'eventIntent(context, event.id)',
    'AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH', 'AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT']) {
    assert.ok(widgets.includes(phrase), phrase);
  }
  assert.match(tile, /if\(isLocked\) unlockAndRun\(open\) else open\.run\(\)/);
  assert.match(tile, /Build\.VERSION\.SDK_INT>=34/);
  assert.match(tile, /QuickEntryActivity::class\.java/);
  assert.match(manifest, /android\.permission\.BIND_QUICK_SETTINGS_TILE/);
});

test('UI-11-06 automation distinguishes emulator evidence from physical One UI proof', () => {
  assert.match(nativeTest, /installedWidgetProvidersAndQuickTileHaveExpectedSecurityAndLabels/);
  assert.match(nativeTest, /listOf\(0, 1, 2, 3\)/);
  assert.match(nativeTest, /listOf\(1f, 2f\)/);
  assert.match(nativeTest, /orientationVariantsUseActualPortraitAndLandscapeDimensionPairs/);
  assert.match(qa, /ScheduleWidgetViewsTest,expo\.modules\.pushoffice\.QuickEntryActivityUiTest/);
  assert.match(capture, /"dumpsys", "appwidget"/);
  assert.match(verify, /widget_providers_registered/);
  assert.match(capture, /"Launcher widget placement, resize and click on third-party launchers"/);
  assert.match(capture, /"Microphone-based speech recognition \(emulator uses -noaudio\)"/);
});
