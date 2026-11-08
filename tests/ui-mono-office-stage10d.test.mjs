import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const calendar = read('app/(tabs)/calendar.tsx');
const settings = read('app/(tabs)/settings.tsx');
const detail = read('app/schedule/[id].tsx');

test('10-D prioritizes next real schedule after quick input while preserving other sections', () => {
  const positions = [
    'label="일정 빠르게 추가"',
    'title="다음 일정"',
    'title="알림에서 일정 추천"',
    'title="오늘의 브리핑"',
    'title="오늘 일정"',
    'title="외부 브리핑"',
  ].map(value => home.indexOf(value));
  assert.ok(positions.every(value => value >= 0), 'Required home block missing');
  assert.ok(positions.every((value, index) => index === 0 || value > positions[index - 1]), 'Home priorities changed');
  assert.doesNotMatch(home, /styles\.nextAccent/);
  assert.match(home, /backgroundColor: colors\.inputBackground, borderColor: colors\.inputBorder/);
  for (const value of ['nextEndAt.getTime() > nextAt.getTime()', 'todayItems.map(', 'PushOfficeNative.openQuickEntry()', 'PushOfficeNative.openVoiceQuickEntry()', 'PushOfficeNative.generateBriefing(', 'external.mutate(']) {
    assert.ok(home.includes(value), value);
  }
});

test('10-D selected calendar summary is informative, not a fake action', () => {
  assert.match(calendar, /style=\{styles\.selectionSummary\}/);
  assert.match(calendar, /accessibilityRole="summary"/);
  assert.doesNotMatch(calendar, /style=\{\[styles\.selectionSummary/);
  assert.ok(calendar.includes('일정 {summary}'));
  for (const value of ['onDayPress={date => setSelected(date.dateString)}','markingType="multi-dot"', 'variant="calendar"', 'schedules.isLoading', 'schedules.isError']) {
    assert.ok(calendar.includes(value), value);
  }
});

test('10-D settings selection and save feedback are neutral, readable and accessible', () => {
  assert.match(settings, /backgroundColor: active \? colors\.primaryLight : colors\.surface/);
  assert.match(settings, /borderColor: active \? colors\.inputBorder : colors\.surfaceBorder/);
  assert.ok(settings.includes('accessibilityState={{ selected: active }}'));
  assert.equal((settings.match(/accessibilityRole="alert"/g) || []).length, 2);
  assert.equal((settings.match(/name="checkmark-circle-outline"/g) || []).length, 2);
  for (const value of ['saveAssistantSettings(patch)', 'PushOfficeNative.setNotificationCaptureEnabled(false)', 'retryLegacyRecovery()']) {
    assert.ok(settings.includes(value), value);
  }
});

test('10-D detail renders local date end values while keeping repeat/save/delete actions', () => {
  assert.match(detail, /const overviewEndDate = end\.trim\(\)/);
  assert.match(detail, /overviewEndDate\.format\(allDay \?/);
  assert.ok(detail.includes('종료 {overviewEnd}'));
  assert.ok(detail.includes('backgroundColor: colors.surface, borderColor: colors.surfaceBorder'));
  assert.match(detail, /accessibilityRole="summary"/);
  for (const value of ['await update.mutateAsync', 'repeatType: repeat, notificationEnabled: notification', "visible={pendingDialog === 'repeat'}", "visible={pendingDialog === 'delete'}", 'PushOfficeNative.snoozeSchedule(id, 10)', 'PushOfficeNative.cancelSnooze(id)', 'remove.mutateAsync(id)']) {
    assert.ok(detail.includes(value), value);
  }
});
