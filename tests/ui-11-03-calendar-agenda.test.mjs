import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../app/(tabs)/calendar.tsx', import.meta.url), 'utf8');
const row = readFileSync(new URL('../src/components/ScheduleItem.tsx', import.meta.url), 'utf8');

test('UI-11-03 keeps month, selected-day summary, action and agenda in order', () => {
  const order = ['<Calendar', 'styles.selectionSummary', 'label="빠른 일정 입력"', 'title="해당 날짜의 일정"'];
  const positions = order.map(value => source.indexOf(value));
  assert.ok(positions.every(p => p >= 0));
  assert.ok(positions.every((p, i) => i === 0 || p > positions[i - 1]));
  assert.match(source, /styles\.selectionPanel/);
  assert.match(source, /styles\.agendaSection/);
  assert.match(source, /날짜를 선택해 일정을 확인하세요/);
});

test('UI-11-03 preserves genuine date selection, count, multi-dot and schedule navigation', () => {
  for (const value of [
    'useMonthSchedules(month.year, month.month)',
    'onDayPress={date => setSelected(date.dateString)}',
    'markingType="multi-dot"',
    'selectedDotColor: colors.onPrimary',
    'Math.min(count, 3)',
    '일정 {summary}',
    'variant="calendar"',
    'schedules.isLoading',
    'schedules.isError',
    'PushOfficeNative.openQuickEntry()',
  ]) assert.ok(source.includes(value), value);
  assert.match(source, /\.sort\(\(a, b\) => a\.startAt\.toMillis\(\) - b\.startAt\.toMillis\(\)\)/);
  assert.match(row, /endAt\.getTime\(\) > startAt\.getTime\(\)/);
  assert.match(row, /REPEAT_LABEL/);
  assert.match(row, /notificationEnabled/);
  assert.match(row, /router\.push\(/);
});

test('UI-11-03 preserves calendar action sizes and excludes fictional schedule data', () => {
  assert.match(source, /minHeight: uiSizes\.touchMinHeight/);
  assert.match(source, /accessibilityRole="summary"/);
  assert.match(source, /<EmptyState message="선택한 날짜에 일정이 없습니다\." \/>/);
  assert.doesNotMatch(source, /회의실 A|Zoom|강남구/);
});
