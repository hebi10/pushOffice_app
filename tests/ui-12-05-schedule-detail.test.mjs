import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const detail = read('app/schedule/[id].tsx');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('UI-12-05 compresses the summary but retains actual start, end, repeat and alert facts', () => {
  assert.match(detail, /accessibilityRole="summary"/);
  assert.match(detail, /numberOfLines=\{2\}>\{title \|\| '제목 없는 일정'\}/);
  assert.match(detail, /style=\{styles\.overviewStatusRow\}/);
  assert.match(detail, /flexWrap: 'wrap'/);
  assert.match(detail, /const overviewEndDate = end\.trim\(\)/);
  assert.match(detail, /overviewEndDate\.format\(allDay \?/);
  assert.match(detail, /종료 \{overviewEnd\}/);
  for (const label of ['매월 반복', '매년 반복', '반복 없음', '알림 사용', '알림 끔']) {
    assert.ok(detail.includes(label), label);
  }
  assert.match(detail, /scheduleOverview: \{ padding: uiSpacing\.xs/);
  assert.match(detail, /overviewTitle: \{ \.\.\.uiTypography\.sectionTitle, fontSize: 18, lineHeight: 25 \}/);
});

test('UI-12-05 keeps repetition edit compact and readable without enabling unsupported cycles', () => {
  assert.match(detail, /title="반복과 알림"/);
  assert.match(detail, /detail\.data\.repeatType !== 'none' \|\| repeat !== 'none'/);
  assert.match(detail, /<View style=\{styles\.repeatOptions\}>/);
  assert.match(detail, /repeatOptions: \{ flexDirection: 'row', flexWrap: 'wrap', gap: uiSpacing\.xs \}/);
  assert.match(detail, /minHeight: uiSizes\.controlMinHeight/);
  assert.match(detail, /accessibilityRole="radio"/);
  assert.match(detail, /accessibilityState=\{\{ checked: repeat === key \}\}/);
  assert.match(detail, /\['none', '반복 안 함'\], \['monthly', '매월 반복'\], \['yearly', '매년 반복'\]/);
  assert.doesNotMatch(detail, /\['daily', '매일'\]|\['weekly', '매주'\]/);
});

test('UI-12-05 keeps save first and separates non-destructive snooze from irreversible deletion', () => {
  const sequence = [
    'title="일정 제목 수정"',
    'title="날짜와 시간"',
    'title="반복과 알림"',
    'label="변경 사항 저장"',
    'title="재알림"',
    'title="일정 삭제"',
  ];
  const indexes = sequence.map(s => detail.indexOf(s));
  assert.ok(indexes.every(n => n >= 0), 'A required detail section is missing');
  assert.ok(indexes.every((n, i) => i === 0 || n > indexes[i - 1]), 'The action priority changed');
  assert.match(detail, /styles\.dangerSection/);
  assert.match(detail, /dangerSection: \{ marginTop: uiSpacing\.sm \}/);
  assert.match(detail, /variant="destructive"/);
  assert.match(detail, /연결된 알림도 삭제되며 되돌릴 수 없습니다\./);
  assert.match(detail, /PushOfficeNative\.snoozeSchedule\(id, 10\)/);
  assert.match(detail, /PushOfficeNative\.cancelSnooze\(id\)/);
  assert.match(detail, /visible=\{pendingDialog === 'delete'\}/);
  assert.match(detail, /visible=\{pendingDialog === 'repeat'\}/);
  assert.match(detail, /confirmLabel="전체 수정"/);
  assert.match(detail, /remove\.mutateAsync\(id\)/);
});

test('UI-12-05 preserves date pickers, all-day, recurrence and SQLite update boundary', () => {
  for (const expression of [
    'await update.mutateAsync',
    'startAt: Timestamp.fromDate(start)',
    'endAt: finish ? Timestamp.fromDate(finish) : null',
    'repeatType: repeat, notificationEnabled: notification',
    "detail.data?.repeatType !== 'none' || repeat !== 'none'",
    'allDay ? \'00:00\' : time',
    'accessibilityLabel="일정 날짜 선택"',
    'accessibilityLabel="시작 시간 선택"',
    'accessibilityLabel="종료 날짜 선택"',
    'accessibilityLabel="종료 시간 선택"',
    "onPress={() => setEnd('')}",
    'setPendingDialog(\'invalid-time\')',
    'keyboardShouldPersistTaps="handled"',
  ]) assert.ok(detail.includes(expression), 'Missing original schedule operation: ' + expression);
  assert.doesNotMatch(detail, /"meetingUrl"|"location"|"notes"|'daily'|'weekly'/);
  for (const name of [
    '11-schedule-detail', '12-schedule-date-modal', '13-schedule-time-modal',
    '12a-schedule-end-date-modal', '13a-schedule-end-time-modal',
    '14a-schedule-repeat-dialog', '14-schedule-delete-dialog',
    '11a-schedule-detail-dark', '17a-schedule-detail-compact',
  ]) {
    assert.ok(capture.includes(name), 'Required Android QA capture missing: ' + name);
    assert.ok(verify.includes(name + '.png'), 'Required Android PNG not checked: ' + name);
  }
});
