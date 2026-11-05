import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const row = read('src/components/ScheduleItem.tsx');

test('PO-UI-02 keeps quick entry before briefing, next event, agenda and external info', () => {
  const indices = [
    home.indexOf('label="일정 빠르게 추가"'),
    home.indexOf('title="오늘의 브리핑"'),
    home.indexOf('title="다음 일정"'),
    home.indexOf('title="오늘 일정"'),
    home.indexOf('title="외부 브리핑"'),
  ];
  assert.ok(indices.every(index => index >= 0), 'A required home section is missing');
  assert.ok(indices.every((index, i) => i === 0 || index > indices[i - 1]), 'Home sections must retain the proposed order');
});

test('PO-UI-02 does not invent to-do, focus or location data', () => {
  assert.doesNotMatch(home, /<AssistantCard title="할 일"/);
  assert.doesNotMatch(home, /<AssistantCard title="집중 시간"/);
  assert.doesNotMatch(home, /보사 회의실|회의실 A/);
  assert.match(home, /todayItems\.length/);
  assert.match(home, /schedules\.isLoading/);
  assert.match(home, /schedules\.isError/);
});

test('PO-UI-02 next appointment preserves occurrence projection and detail navigation', () => {
  assert.match(home, /nextSchedule\(/);
  assert.match(home, /projectOccurrences\(/);
  assert.match(home, /next\.endAt\?\.toDate/);
  assert.match(home, /nextEndAt\.getTime\(\) > nextAt\.getTime\(\)/);
  assert.match(home, /next\.isAllDay/);
  assert.match(home, /router\.push\(`\/schedule\/\$\{next\.id\}`\)/);
  assert.match(home, /accessibilityLabel=\{\`\$\{next\.title\}/);
});

test('PO-UI-02 keeps all real today occurrences and distinguishes empty/loading/error', () => {
  assert.match(home, /todayItems\.map\(/);
  assert.match(home, /key=\{\`\$\{item\.id/);
  assert.match(home, /<ScheduleItem/);
  assert.match(home, /다가오는 일정이 없습니다/);
  assert.match(home, /일정 목록을 불러오는 중입니다/);
  assert.match(home, /일정을 불러오지 못했습니다/);
});

test('PO-UI-02 preserves AI, user-triggered external data and local-only quick entry', () => {
  assert.match(home, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(home, /PushOfficeNative\.generateBriefing\(/);
  assert.match(home, /runForegroundRequest\(/);
  assert.match(home, /external\.mutate\(/);
  assert.match(home, /allowExternal: true/);
  assert.match(home, /기기\s*안|기기에 저장된 일정/);
});

test('PO-UI-02 agenda rows show valid time ranges and repetition without changing storage', () => {
  assert.match(row, /endAt\.getTime\(\) > startAt\.getTime\(\)/);
  assert.match(row, /schedule\.isAllDay/);
  assert.match(row, /REPEAT_LABEL/);
  assert.match(row, /notificationEnabled/);
  assert.match(row, /router\.push\(`\/schedule\/\$\{schedule\.id\}`\)/);
});
