import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const detail = source('app/schedule/[id].tsx');
const field = source('src/components/schedule/SchedulePickerField.tsx');
const picker = source('src/components/schedule/SchedulePickerDialog.tsx');
const dialog = source('src/components/ui/AppDialog.tsx');
const capture = source('tools/ui/capture_android.py');

test('PO-UI-06 uses distinct editing groups and preserves the primary save action', () => {
  const order = [
    'title="기본 정보"',
    'title="날짜와 시간"',
    'title="반복과 알림"',
    'label="변경 사항 저장"',
    'title="재알림"',
    'title="삭제 전 확인"',
  ].map(label => detail.indexOf(label));
  assert.ok(order.every(index => index !== -1), 'Required editing group is missing');
  assert.ok(order.every((value, index) => index === 0 || value > order[index - 1]), 'Unexpected editing order');
  assert.match(detail, /<SettingRow title="하루 종일"/);
  assert.match(detail, /<SettingRow\s+title="일정 알림"/);
  assert.match(detail, /<AssistantTextField/);
});

test('PO-UI-06 retains real schedule save, repeat confirmation and safe deletion', () => {
  assert.match(detail, /await update\.mutateAsync/);
  assert.match(detail, /startAt: Timestamp\.fromDate\(start\)/);
  assert.match(detail, /repeatType: repeat, notificationEnabled: notification/);
  assert.match(detail, /detail\.data\?\.repeatType !== 'none' \|\| repeat !== 'none'/);
  assert.match(detail, /setPendingDialog\('repeat'\)/);
  assert.match(detail, /visible=\{pendingDialog === 'repeat'\}/);
  assert.match(detail, /confirmLabel="전체 수정"/);
  assert.match(detail, /visible=\{pendingDialog === 'delete'\}/);
  assert.match(detail, /destructive/);
  assert.match(detail, /remove\.mutateAsync\(id\)/);
  assert.match(detail, /onDismiss=\{\(\) => setPendingDialog\(null\)\}/);
});

test('PO-UI-06 preserves end-time, all-day, recurrence and notification workflows', () => {
  assert.match(detail, /setEnd\(day\.dateString \+ ' ' \+ \(end\.trim\(\)\.split\(' '\)\[1\] \|\| time\)\)/);
  assert.match(detail, /setEnd\(\(end\.split\(' '\)\[0\] \|\| date\) \+ ' ' \+ formatted\)/);
  assert.match(detail, /onPress=\{\(\) => setEnd\(''\)\}/);
  assert.match(detail, /allDay \? '00:00' : time/);
  assert.match(detail, /repeat === key/);
  assert.match(detail, /PushOfficeNative\.snoozeSchedule\(id, 10\)/);
  assert.match(detail, /PushOfficeNative\.cancelSnooze\(id\)/);
});

test('PO-UI-06 picker controls have consistent labels, icons and minimum tap targets', () => {
  assert.match(detail, /accessibilityLabel="일정 날짜 선택"/);
  assert.match(detail, /accessibilityLabel="시작 시간 선택"/);
  assert.match(detail, /accessibilityLabel="종료 날짜 선택"/);
  assert.match(detail, /accessibilityLabel="종료 시간 선택"/);
  assert.match(field, /accessibilityRole="button"/);
  assert.match(field, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
  assert.match(field, /minHeight: uiSizes\.controlMinHeight/);
  assert.match(field, /borderWidth: uiSizes\.borderWidth/);
});

test('PO-UI-06 picker dialogs share panel tokens and keyboard/back controls', () => {
  assert.match(picker, /KeyboardAvoidingView/);
  assert.match(picker, /Platform\.OS === 'ios' \? 'padding' : 'height'/);
  assert.match(picker, /onRequestClose=\{onDismiss\}/);
  assert.match(picker, /keyboardShouldPersistTaps="handled"/);
  assert.match(picker, /maxWidth: uiSizes\.dialogMaxWidth/);
  assert.match(picker, /maxHeight: '88%'/);
  assert.match(picker, /uiRadii\.dialog/);
  assert.match(dialog, /maxWidth: uiSizes\.dialogMaxWidth/);
  assert.match(dialog, /colors\.onDanger/);
  assert.match(detail, /selectedDayTextColor: colors\.onPrimary/);
  assert.match(detail, /visible=\{pendingDialog === 'invalid-time'\}/);
});

test('PO-UI-06 shows a recoverable missing/loading/error state', () => {
  assert.match(detail, /detail\.isLoading/);
  assert.match(detail, /detail\.isError/);
  assert.match(detail, /<EmptyState message=/);
  assert.match(detail, /label="일정 목록으로 돌아가기"/);
  assert.match(detail, /router\.back\(\)/);
});

test('PO-UI-06 emulator suite captures date/end-time, repeat, delete, dark and compact detail', () => {
  for (const name of [
    '11-schedule-detail',
    '12-schedule-date-modal',
    '12a-schedule-end-date-modal',
    '13-schedule-time-modal',
    '13a-schedule-end-time-modal',
    '14a-schedule-repeat-dialog',
    '14-schedule-delete-dialog',
    '11a-schedule-detail-dark',
    '17a-schedule-detail-compact',
  ]) assert.ok(capture.includes(name), 'Missing capture: ' + name);
});
