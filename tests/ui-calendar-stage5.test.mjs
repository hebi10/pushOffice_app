import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectOccurrences } from '../src/features/schedules/scheduleCodec.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const calendar = read('app/(tabs)/calendar.tsx');
const row = read('src/components/ScheduleItem.tsx');
const capture = read('tools/ui/capture_android.py');

test('PO-UI-05 keeps calendar first, selected-date summary, quick entry, then agenda', () => {
  const indices = [
    calendar.indexOf('<Calendar'),
    calendar.indexOf('styles.selectionSummary'),
    calendar.indexOf('label="빠른 일정 입력"'),
    calendar.indexOf('title="해당 날짜의 일정"'),
  ];
  assert.ok(indices.every(x => x >= 0), 'Missing calendar stage section');
  assert.ok(indices.every((x, i) => i === 0 || x > indices[i - 1]), 'Calendar hierarchy has changed');
  assert.match(calendar, /useMonthSchedules\(month\.year, month\.month\)/);
  assert.match(calendar, /onMonthChange=\{date =>/);
  assert.match(calendar, /onDayPress=\{date => setSelected\(date\.dateString\)\}/);
  assert.match(calendar, /monthFormat="yyyy년 M월"/);
  assert.match(calendar, /enableSwipeMonths/);
});

test('PO-UI-05 markers display one to three dots using the same occurrence list', () => {
  assert.match(calendar, /for \(const item of schedules\.data \?\? \[\]\)/);
  assert.match(calendar, /counts\.set\(date, \(counts\.get\(date\) \?\? 0\) \+ 1\)/);
  assert.match(calendar, /Math\.min\(count, 3\)/);
  assert.match(calendar, /markingType="multi-dot"/);
  assert.match(calendar, /selectedDotColor: colors\.onPrimary/);
  assert.match(calendar, /selectedTextColor: colors\.onPrimary/);
  assert.match(calendar, /selectedColor: colors\.primary/);
  assert.match(calendar, /날짜 아래 점은 일정 개수/);
});

test('PO-UI-05 selected day does not confuse loading, errors, empty and real occurrences', () => {
  assert.match(calendar, /item\.startAt\.toDate\(\)/);
  assert.match(calendar, /=== selected/);
  assert.match(calendar, /schedules\.isLoading/);
  assert.match(calendar, /schedules\.isError/);
  assert.match(calendar, /items\.length/);
  assert.match(calendar, /<EmptyState message=/);
  assert.match(calendar, /variant="calendar"/);
  assert.match(calendar, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.doesNotMatch(calendar, /회의실 A|Zoom|강남구/);
});

test('PO-UI-05 compact agenda preserves home rows, title, time ranges, recurrence and navigation', () => {
  assert.match(row, /variant = 'default'/);
  assert.match(row, /calendar = variant === 'calendar'/);
  assert.match(row, /calendar \? styles\.calendarContainer : null/);
  assert.match(row, /accentRail/);
  assert.match(row, /numberOfLines=\{calendar \? 3 : 2\}/);
  assert.match(row, /endAt\.getTime\(\) > startAt\.getTime\(\)/);
  assert.match(row, /schedule\.isAllDay/);
  assert.match(row, /REPEAT_LABEL/);
  assert.match(row, /notificationEnabled/);
  assert.match(row, /router\.push\(/);
  assert.match(row, /accessibilityLabel=/);
});

test('PO-UI-05 keeps monthly and yearly occurrence anchors and end times intact', () => {
  const anchor = Date.parse('2024-01-31T01:00:00Z');
  const event = {
    id: 'repeat',
    userId: 'local',
    type: 'schedule',
    title: '월말 보고',
    anchorZone: 'Asia/Seoul',
    startAt: anchor,
    endAt: anchor + 3600000,
    repeatType: 'monthly',
    isAllDay: false,
    notificationEnabled: true,
    notificationId: null,
    sourceText: '',
    createdAt: anchor,
    updatedAt: anchor,
  };
  const start = new Date('2024-02-01T00:00:00+09:00');
  const end = new Date('2024-04-01T00:00:00+09:00');
  const projected = projectOccurrences([event], start, end);
  assert.deepEqual(projected.map(x => new Date(x.startAt).toISOString()), [
    '2024-02-29T01:00:00.000Z',
    '2024-03-31T01:00:00.000Z',
  ]);
  assert.ok(projected.every(x => x.endAt - x.startAt === 3600000 && x.notificationEnabled));
  assert.equal(event.startAt, anchor);
  const yearly = projectOccurrences([{ ...event, repeatType: 'yearly' }], start, end);
  assert.equal(yearly.length, 0);
});

test('PO-UI-05 emulator verification includes populated, dark and compact calendar screens', () => {
  assert.match(capture, /02-calendar/);
  assert.match(capture, /02a-calendar-with-schedule/);
  assert.match(capture, /02b-calendar-dark/);
  assert.match(capture, /02c-calendar-compact/);
});
