import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shared = read('src/components/AssistantUI.tsx');
const briefing = read('app/(tabs)/briefing.tsx');
const history = read('app/(tabs)/chatHistory.tsx');
const home = read('app/(tabs)/index.tsx');
const calendar = read('app/(tabs)/calendar.tsx');
const settings = read('app/(tabs)/settings.tsx');
const detail = read('app/schedule/[id].tsx');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');
const widgets = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleWidgetViews.kt');

test('precision stage 7 keeps full-width phones and centers tablet main routes', () => {
  assert.match(shared, /content:\s*\{\s*width: '100%',\s*maxWidth: 720,\s*alignSelf: 'center'/);
  assert.match(briefing, /scrollContent:\s*\{\s*width: '100%',\s*maxWidth: 720,\s*alignSelf: 'center'/);
  assert.match(history, /pageHeading:\s*\{ width: '100%', maxWidth: 720, alignSelf: 'center'/);
  assert.match(history, /listContent:\s*\{ width: '100%', maxWidth: 720, alignSelf: 'center'/);
  assert.match(history, /emptyContainer:\s*\{\s*flex: 1,\s*width: '100%',\s*maxWidth: 720,\s*alignSelf: 'center'/);
  for (const screen of [home, calendar, settings, detail]) {
    assert.match(screen, /contentContainerStyle=\{s\.content\}/);
  }
});

test('precision stage 7 makes 130 percent font screenshots mandatory', () => {
  assert.match(capture, /"font_scale", "1\.3"/);
  assert.match(capture, /settings", "get", "system", "font_scale"/);
  assert.match(capture, /"20a-large-font-home"/);
  assert.match(capture, /"20b-large-font-calendar"/);
  assert.match(capture, /"20c-large-font-settings"/);
  assert.match(capture, /"20d-large-font-chooser"/);
  assert.match(capture, /"20e-large-font-editor"/);
  assert.match(capture, /finally:\s*adb\("shell", "settings", "put", "system", "font_scale", "1\.0"\)/);
  for (const suffix of ['20a-large-font-home', '20b-large-font-calendar',
    '20c-large-font-settings', '20d-large-font-chooser', '20e-large-font-editor']) {
    assert.ok(verify.includes(suffix + '.png'));
  }
});

test('precision stage 7 requires an actual enlarged tablet-class emulator viewport', () => {
  assert.match(capture, /"wm", "size", "1440x2160"/);
  assert.match(capture, /"wm", "density", "280"/);
  assert.match(verify, /tablet_w <= normal\[0\]/);
  assert.match(verify, /tablet_h <= normal\[1\]/);
  for (const suffix of ['21a-tablet-home', '21b-tablet-calendar',
    '21c-tablet-settings', '21d-tablet-chooser', '21e-tablet-editor']) {
    assert.ok(capture.includes(suffix));
    assert.ok(verify.includes(suffix + '.png'));
  }
});

test('precision stage 7 verifies installed widget registration without claiming launcher placement', () => {
  assert.match(capture, /"dumpsys", "appwidget"/);
  assert.match(capture, /"ScheduleWidgetProvider" in widget_dump/);
  assert.match(capture, /"ScheduleAgendaWidgetProvider" in widget_dump/);
  assert.match(verify, /widget_providers_registered/);
  for (const feature of ['setOnClickPendingIntent(row,', 'eventIntent(context, event.id)',
    'entryIntent(context, "text")', 'entryIntent(context, "voice")']) {
    assert.ok(widgets.includes(feature));
  }
});

test('precision stage 7 leaves unsupported real-device checks explicitly unverified', () => {
  assert.match(capture, /"Physical phone and real tablet hardware"/);
  assert.match(capture, /"Launcher widget placement, resize and click on third-party launchers"/);
  assert.match(capture, /"Microphone-based speech recognition \(emulator uses -noaudio\)"/);
  assert.match(capture, /"Gemini Nano inference on supported real hardware"/);
  assert.match(capture, /"Play Store install\/update on a tester account"/);
  assert.match(capture, /"device-matrix\.json"/);
  assert.match(verify, /device-matrix\.json is missing/);
});

test('precision stage 7 retains the existing 40-screen regression matrix', () => {
  for (const name of ['01-home', '02-calendar', '03-settings', '05-quick-entry',
    '07b-native-confirmation-actions', '11-schedule-detail',
    '14-schedule-delete-dialog', '17b-compact-confirmation-actions',
    '18-legacy-briefing', '19-legacy-chat-history']) {
    assert.ok(verify.includes('"' + name + '.png"'), 'Missing previous regression capture: ' + name);
  }
});
