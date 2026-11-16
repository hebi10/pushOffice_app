import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { projectOccurrences, nextOccurrence, nextSchedule } from '../src/features/schedules/scheduleCodec.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = value => Date.parse(value);
const record = (startAt, repeatType, endAt = null, anchorZone = 'Asia/Seoul') => ({
  id: repeatType, userId: 'local', type: 'schedule', title: '회의',
  startAt, endAt, isAllDay: false, repeatType, notificationEnabled: true,
  notificationId: null, sourceText: '', createdAt: 1, updatedAt: 1, anchorZone,
});

test('FUNC-12-03 daily occurrences preserve local wall time across DST and existing end duration', () => {
  const start = at('2027-03-12T09:30:00-05:00');
  const item = record(start, 'daily', start + 90 * 60000, 'America/New_York');
  const result = projectOccurrences([item], new Date('2027-03-13T00:00:00-05:00'), new Date('2027-03-16T00:00:00-04:00'));
  assert.deepEqual(result.map(x => new Date(x.startAt).toISOString()), [
    '2027-03-13T14:30:00.000Z',
    '2027-03-14T13:30:00.000Z',
    '2027-03-15T13:30:00.000Z',
  ]);
  assert.ok(result.every(x => x.endAt - x.startAt === 90 * 60000));
  const next = nextOccurrence(item, at('2027-03-13T10:00:00-05:00'));
  assert.equal(next?.startAt, at('2027-03-14T09:30:00-04:00'));
  assert.equal(item.startAt, start);
});

test('weekly interval keeps original weekday/anchor and end time in calendar and home', () => {
  const start = at('2026-11-19T15:00:00+09:00');
  const item = record(start, 'weekly', start + 3600000);
  const result = projectOccurrences([item], new Date('2026-11-01T00:00:00+09:00'), new Date('2026-12-01T00:00:00+09:00'));
  assert.deepEqual(result.map(x => new Date(x.startAt).toISOString()), [
    '2026-11-19T06:00:00.000Z', '2026-11-26T06:00:00.000Z',
  ]);
  assert.equal(nextSchedule([item], at('2026-11-20T12:00:00+09:00'))?.startAt, at('2026-11-26T15:00:00+09:00'));
  assert.ok(result.every(x => x.endAt === x.startAt + 3600000));
});

test('daily/weekly do not create occurrences before the original series anchor', () => {
  const start = at('2026-11-21T09:00:00+09:00');
  const daily = record(start, 'daily');
  const weekly = record(start, 'weekly');
  const month = [new Date('2026-11-01T00:00:00+09:00'), new Date('2026-12-01T00:00:00+09:00')];
  const dates = projectOccurrences([daily, weekly], ...month);
  assert.ok(dates.every(x => x.startAt >= start));
  assert.equal(dates.filter(x => x.repeatType === 'daily').length, 10);
  assert.equal(dates.filter(x => x.repeatType === 'weekly').length, 2);
});

test('monthly and yearly old anchors remain unchanged including end durations', () => {
  const start = at('2027-01-31T09:00:00+09:00');
  const item = record(start, 'monthly', start + 45 * 60000);
  const dates = projectOccurrences([item], new Date('2027-02-01T00:00:00+09:00'), new Date('2027-04-01T00:00:00+09:00'));
  assert.deepEqual(dates.map(x => new Date(x.startAt).toISOString()), [
    '2027-02-28T00:00:00.000Z', '2027-03-31T00:00:00.000Z',
  ]);
  assert.ok(dates.every(x => x.endAt - x.startAt === 45 * 60000));
  const yearly = record(at('2024-02-29T09:00:00+09:00'), 'yearly');
  assert.equal(nextOccurrence(yearly, at('2027-04-01T00:00:00+09:00'))?.startAt, at('2028-02-29T09:00:00+09:00'));
});

test('schedule type, backups, UI and native form include all five recurrence values', () => {
  const types = read('src/types/index.ts');
  const bridge = read('modules/push-office-native/index.ts');
  const backup = read('src/features/storage/localBackupCodec.mjs');
  const detail = read('app/schedule/[id].tsx');
  const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
  for (const entry of ['daily', 'weekly']) {
    assert.ok(types.includes("'" + entry + "'"));
    assert.ok(bridge.includes("'" + entry + "'"));
    assert.ok(backup.includes("'" + entry + "'"));
    assert.ok(detail.includes("'" + entry + "'"));
    assert.ok(native.includes('"' + entry + '"'));
  }
  assert.match(native, /종료 시간 지정/);
  assert.match(native, /종료 날짜 선택/);
  assert.match(native, /종료 시간 선택/);
  assert.match(native, /endAt == null \|\| endAt > start/);
  assert.match(native, /ScheduleRuntime\.save\(this,draft\)/);
});
