import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const calendar = read('app/(tabs)/calendar.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const card = read('src/components/AssistantUI.tsx');
const item = read('src/components/ScheduleItem.tsx');

test('precision stage 3 uses a compact calendar intro without changing other screens', () => {
  assert.match(calendar, /<ScreenIntro title="캘린더" compact \/>/);
  assert.doesNotMatch(calendar, /eyebrow="날짜별 일정"/);
  assert.doesNotMatch(calendar, /artwork=\{require\(/);
  assert.match(intro, /compact = false/);
  assert.match(intro, /compact && styles\.compactContainer/);
  assert.match(intro, /compact && styles\.compactTitle/);
  assert.match(intro, /artwork && !compact && !isDark/);
  assert.match(intro, /minHeight: 48/);
});

test('precision stage 3 reduces calendar week gaps while preserving month/date navigation', () => {
  assert.match(calendar, /stylesheet\.calendar\.main/);
  assert.match(calendar, /marginTop: 1, marginBottom: 1/);
  assert.match(calendar, /dayTextAtIndex0: \{ color: colors\.danger \}/);
  assert.match(calendar, /dayTextAtIndex6: \{ color: colors\.primary \}/);
  assert.match(calendar, /stylesheet\.calendar\.header/);
  assert.match(calendar, /theme=\{calendarTheme\}/);
  assert.match(calendar, /enableSwipeMonths/);
  assert.match(calendar, /onMonthChange=\{date =>/);
  assert.match(calendar, /onDayPress=\{date => setSelected\(date\.dateString\)\}/);
  assert.match(calendar, /monthFormat="yyyy년 M월"/);
});

test('precision stage 3 keeps genuine 1 to 3 event dots, count, selection and theme contrast', () => {
  assert.match(calendar, /useMonthSchedules\(month\.year, month\.month\)/);
  assert.match(calendar, /Math\.min\(count, 3\)/);
  assert.match(calendar, /color: dotColors\[index\]/);
  assert.match(calendar, /selectedDotColor: colors\.onPrimary/);
  assert.match(calendar, /markingType="multi-dot"/);
  assert.match(calendar, /selectedColor: colors\.primary/);
  assert.match(calendar, /styles\.selectionSummary/);
  assert.match(calendar, /accessibilityLabel=\{selectedLabel \+ ', 일정 ' \+ summary\}/);
  assert.match(calendar, /일정 \{summary\}/);
  assert.match(calendar, /날짜 아래 점은 일정 개수/);
});

test('precision stage 3 flattens only the agenda wrapper and keeps agenda cards readable', () => {
  assert.match(calendar, /title="해당 날짜의 일정" icon="list-outline" flat/);
  assert.match(card, /flat = false/);
  assert.match(card, /flat && styles\.flatCard/);
  assert.match(card, /backgroundColor: flat \? colors\.background : colors\.surface/);
  assert.match(calendar, /items\.map\(item =>/);
  assert.match(calendar, /\.sort\(\(a, b\) => a\.startAt\.toMillis\(\) - b\.startAt\.toMillis\(\)\)/);
  assert.match(item, /calendarContainer: \{ minHeight: 68, gap: uiSpacing\.xs, paddingVertical: uiSpacing\.xs \}/);
  assert.match(calendar, /variant="calendar"/);
  assert.match(item, /numberOfLines=\{calendar \? 3 : 2\}/);
  assert.match(item, /router\.push\(/);
  assert.match(item, /REPEAT_LABEL/);
  assert.match(item, /notificationEnabled/);
});

test('precision stage 3 retains quick entry and distinct loading, error and empty states', () => {
  assert.match(calendar, /label="빠른 일정 입력"/);
  assert.match(calendar, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(calendar, /schedules\.isLoading/);
  assert.match(calendar, /schedules\.isError/);
  assert.match(calendar, /<EmptyState message=/);
  assert.doesNotMatch(calendar, /회의실 A|Zoom|강남구/);
});

test('calendar redesign stage 2 captures selected days with one and three real local events', () => {
  const capture = read('tools/ui/capture_android.py');
  const verify = read('tools/ui/verify_captures.py');
  for (const name of ['23a-calendar-today-one', '23b-calendar-today-three', '23c-calendar-today-three-list']) {
    assert.ok(capture.includes('screenshot("' + name + '"'), 'Missing populated calendar screenshot ' + name);
    assert.ok(verify.includes('"' + name + '.png"'), 'Missing required verification ' + name);
  }
  assert.match(capture, /find\("일정 1건"\)/);
  assert.match(capture, /find\("일정 3건"\)/);
  assert.match(capture, /find\("TodayQA1"\)/);
  assert.match(calendar, /<EmptyState message="선택한 날짜에 일정이 없습니다\." \/>/);
});
