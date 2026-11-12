import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { retainSelectedDayInMonth } from '../src/features/schedules/calendarSelection.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const calendar = read('app/(tabs)/calendar.tsx');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('UI-12-03 retains the selected day and clamps safely on 5/6-week short months', () => {
  assert.equal(retainSelectedDayInMonth('2026-01-31', 2026, 2), '2026-02-28');
  assert.equal(retainSelectedDayInMonth('2024-01-31', 2024, 2), '2024-02-29');
  assert.equal(retainSelectedDayInMonth('2026-05-15', 2026, 6), '2026-06-15');
  assert.equal(retainSelectedDayInMonth('2026-02-28', 2026, 3), '2026-03-28');
  assert.equal(retainSelectedDayInMonth('2026-01-30', 2026, 4), '2026-04-30');
  assert.equal(retainSelectedDayInMonth('broken', 2026, 11), '2026-11-01');
  assert.throws(() => retainSelectedDayInMonth('2026-01-31', 2026, 13), RangeError);
  assert.throws(() => retainSelectedDayInMonth('2026-01-31', 2026, 0), RangeError);
});

test('UI-12-03 connects the selected-day summary to the calendar without another card', () => {
  assert.ok(calendar.includes('setSelected(previous => retainSelectedDayInMonth(previous, date.year, date.month))'));
  assert.ok(calendar.includes('onDayPress={date => setSelected(date.dateString)}'));
  assert.ok(calendar.includes('style={[styles.selectionPanel, { backgroundColor: colors.inputBackground }]}'));
  assert.ok(calendar.includes('style={styles.selectionSummary}'));
  assert.ok(calendar.indexOf('styles.selectionPanel') > calendar.indexOf('<Calendar'));
  assert.ok(calendar.includes('accessibilityRole="summary"'));
  assert.ok(calendar.includes("accessibilityLabel={selectedLabel + ', 일정 ' + summary}"));
  assert.ok(calendar.includes('numberOfLines={1}>{selectedLabel}</Text>'));
  assert.ok(calendar.includes('점은 일정 건수를 나타냅니다 (최대 3개)'));
  assert.ok(calendar.includes('날짜 아래 점은 일정 개수(최대 3개)'));
  assert.ok(calendar.includes('paddingBottom: 0'));
});

test('UI-12-03 keeps the selected date in view when jumping to its agenda', () => {
  assert.ok(calendar.includes('const calendarScrollRef = useRef<ScrollView>(null)'));
  assert.ok(calendar.includes('const agendaTop = useRef(0)'));
  assert.ok(calendar.includes('ref={calendarScrollRef}'));
  assert.ok(calendar.includes('accessibilityRole="button"'));
  assert.ok(calendar.includes('선택 날짜 일정 목록으로 이동'));
  assert.ok(calendar.includes('onPress={scrollToSelectedAgenda}'));
  assert.ok(calendar.includes('onLayout={event => { agendaTop.current = event.nativeEvent.layout.y; }}'));
  assert.ok(calendar.includes('animated: false'));
  assert.ok(calendar.includes('minHeight: uiSizes.touchMinHeight'));
  assert.ok(capture.includes('tap("선택 날짜 일정 목록으로 이동")'));
  assert.ok(capture.includes('screenshot("23c-calendar-today-three-list"'));
  assert.ok(verify.includes('"23c-calendar-today-three-list.png"'));
});

test('UI-12-03 keeps all genuine schedule states, month query and native entry unchanged', () => {
  for (const value of [
    'useMonthSchedules(month.year, month.month)',
    'markingType="multi-dot"',
    'Math.min(count, 3)',
    'selectedDotColor: colors.onPrimary',
    'colors.danger',
    "dayTextAtIndex0: { color: colors.danger }",
    'dayTextAtIndex6: { color: colors.primary }',
    '.sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis())',
    'label="빠른 일정 입력"',
    'PushOfficeNative.openQuickEntry()',
    'title="해당 날짜의 일정" icon="list-outline" flat',
    'variant="calendar"',
    'schedules.isLoading',
    'schedules.isError',
    '<EmptyState message="선택한 날짜에 일정이 없습니다." />',
  ]) {
    assert.ok(calendar.includes(value), 'Calendar behavior must stay intact: ' + value);
  }
  assert.doesNotMatch(calendar, /회의실 A|Zoom|강남구|다음 날짜에 자동 입력/);
});
