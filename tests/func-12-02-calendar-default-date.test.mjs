import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('FUNC-12-02 calendar sends the currently selected YYYY-MM-DD, not a timezone-shifted epoch', () => {
  const screen = read('app/(tabs)/calendar.tsx');
  const module = read('modules/push-office-native/index.ts');
  const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
  const date = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/CalendarQuickEntryDate.kt');
  assert.match(screen, /openQuickEntryForDate\(selected\)/);
  assert.match(module, /openQuickEntryForDate\(date: string\): Promise<void>/);
  assert.match(native, /AsyncFunction\("openQuickEntryForDate"\)/);
  assert.match(native, /CalendarQuickEntryDate\.parse\(selectedDate\)/);
  assert.match(native, /\.putExtra\(CalendarQuickEntryDate\.EXTRA_DATE, date\.toString\(\)\)/);
  assert.match(date, /LocalDate\.parse\(value, DateTimeFormatter\.ISO_LOCAL_DATE\)/);
  assert.doesNotMatch(date, /Instant\.parse|toEpochMilli|System\.currentTimeMillis/);
});

test('native preview retains explicit dates, does not invent time or bypass user save', () => {
  const source = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
  const parser = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleParser.kt');
  assert.match(source, /ScheduleParser\.parse\(source,ZonedDateTime\.now\(zone\),calendarDate\)/);
  assert.match(source, /preferredDate\?\.toString\(\)\.orEmpty\(\)/);
  assert.match(source, /timeField=field\("시간 \(HH:mm\)".*dateTime\?\.toLocalTime\(\).*\.orEmpty\(\)/);
  assert.match(source, /!ScheduleParser\.mentionsDate\(source\)/);
  assert.match(source, /ScheduleRuntime\.save\(this,draft\)/);
  assert.match(parser, /if\(date == null\) date = calendarDate/);
  assert.match(parser, /fun mentionsDate\(text: String\)/);
  assert.match(parser, /if\(time == null && colon == null\) return ParsedSchedule\(error=/);
});

test('on-device AI cannot substitute a different date for the selected or explicit date', () => {
  const model = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiModelRunner.kt');
  const nano = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NanoClient.kt');
  const check = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiScheduleTime.kt');
  assert.match(model, /ScheduleParser\.parse\(text, now, calendarDate\)/);
  assert.match(nano, /Explicit user dates always win/);
  assert.match(check, /ScheduleParser\.parse\(text, now, calendarDate\)/);
  assert.match(check, /start\.toInstant\(\) == ground\.start\.toInstant\(\)/);
});

test('legacy home/widget/tile entry remains unchanged while calendar supplies a default date', () => {
  const screen = read('app/(tabs)/index.tsx');
  const bridge = read('modules/push-office-native/index.ts');
  const module = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
  assert.match(screen, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(bridge, /openQuickEntry\(\): Promise<void>/);
  assert.match(module, /AsyncFunction\("openQuickEntry"\)/);
  assert.match(module, /AsyncFunction\("openVoiceQuickEntry"\)/);
});
