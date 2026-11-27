import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { weekDateKeys, weekBounds, shiftCivilDate, weekDayRows } from '../src/features/schedules/calendarWeek.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('weekly dates cross month/year boundaries without fixed millisecond arithmetic',()=>{
  assert.deepEqual(weekDateKeys('2026-12-31'),['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
  assert.equal(shiftCivilDate('2028-02-28',1),'2028-02-29');
  assert.equal(shiftCivilDate('2026-11-30',7),'2026-12-07');
  const {start,end}=weekBounds('2026-12-31');
  assert.equal(start.getDate(),27);assert.equal(start.getHours(),0);
  assert.equal(end.getDate(),2);assert.equal(end.getHours(),23);assert.equal(end.getMilliseconds(),999);
  assert.throws(()=>weekDateKeys('2027-02-29'));
});
test('weekly date rows keep every day within the measured width at a 48dp minimum', () => {
  const days = weekDateKeys('2026-11-27');
  assert.deepEqual(weekDayRows(days, 360, 48, 4), [days]);
  assert.deepEqual(weekDayRows(days, 312, 48, 4), [days.slice(0, 4), days.slice(4)]);
  const narrower = weekDayRows(days, 142, 48, 4);
  assert.deepEqual(narrower.flat(), days);
  assert.ok(narrower.every(row => row.length * 48 + (row.length - 1) * 4 <= 142));
});
test('home candidate refresh clears data on invalid visits and displays unconfirmed date explicitly',()=>{
  const hook=read('src/features/notifications/useLiveNotificationSuggestions.ts');
  const home=read('app/(tabs)/index.tsx');
  assert.match(hook,/getNotificationSuggestionSnapshot/);
  assert.match(hook,/visit !== revision\.current/);
  assert.match(hook,/snapshot\.status\.enabled && snapshot\.status\.accessGranted/);
  assert.match(hook,/clearInterval\(interval\); listener\.remove\(\); app\.remove\(\)/);
  assert.match(home,/item\.startAt == null \? '날짜·시간 확인 필요'/);
  assert.match(home,/showAllSuggestions \? notificationSuggestions : notificationSuggestions\.slice/);
  assert.match(home,/void schedules\.refetch\(\); void refreshSuggestions\(\)/);
  const calendar=read('app/(tabs)/calendar.tsx');
  assert.match(calendar,/useWeekSchedules\(selected, mode === 'week'\)/);
  assert.match(calendar,/shiftCivilDate\(selected,-7\)/);
  assert.match(calendar,/shiftCivilDate\(selected,7\)/);
  assert.match(calendar,/openQuickEntryForDate\(selected\)/);
});
