import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = source('app/(tabs)/index.tsx');
const cards = source('src/components/AssistantUI.tsx');
const scheduleRow = source('src/components/ScheduleItem.tsx');

test('precision stage 2 keeps existing main action and compact briefing/agenda hierarchy', () => {
  const sections = [
    'label="일정 빠르게 추가"',
    'title="다음 일정"',
    'title="오늘의 브리핑"',
    'title="오늘 일정"',
    'title="외부 브리핑"',
  ];
  const positions = sections.map(x => home.indexOf(x));
  assert.ok(positions.every(p => p !== -1));
  assert.ok(positions.every((p, i) => i === 0 || positions[i - 1] < p));
  for (const name of ['오늘의 브리핑', '다음 일정', '오늘 일정']) {
    assert.ok(home.includes('title="' + name + '"') && home.includes('title="' + name + '" icon='));
    assert.match(home, new RegExp('title="' + name + '"[^>]*compact>'));
  }
  assert.match(cards, /compact = false/);
  assert.match(cards, /compact && styles\.compactCard/);
  assert.match(cards, /compactCard: \{ paddingVertical: uiSpacing\.sm, gap: uiSpacing\.xs \}/);
});

test('precision stage 2 does not repeat briefing footnote below action button', () => {
  assert.equal(home.split('기기에 저장된 일정만으로 만든 요약').length - 1, 1);
  assert.equal(home.split('Gemini Nano가 기기에서 정리한 브리핑').length - 1, 1);
  assert.match(home, /briefingCopy: \{ flex: 1, gap: uiSpacing\.xxs \}/);
  assert.match(home, /schedules\.isError/);
  assert.match(home, /schedules\.isLoading/);
  assert.match(home, /todayItems\.length/);
});

test('precision stage 2 highlights actual next schedule and keeps every daily entry accessible', () => {
  assert.doesNotMatch(home, /styles\.nextAccent/);
  assert.match(home, /backgroundColor: colors\.inputBackground, borderColor: colors\.inputBorder/);
  assert.match(home, /router\.push\(`\/schedule\/\$\{next\.id\}`\)/);
  assert.match(home, /nextEndAt\.getTime\(\) > nextAt\.getTime\(\)/);
  assert.match(home, /todayItems\.map\(/);
  assert.match(scheduleRow, /<View style=\{\[styles\.accentRail/);
  assert.match(scheduleRow, /router\.push\(`\/schedule\/\$\{schedule\.id\}`\)/);
  assert.match(scheduleRow, /calendarContainer: \{ minHeight: 68/);
});

test('precision stage 2 leaves local assistant and user-triggered external network intact', () => {
  assert.match(home, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(home, /PushOfficeNative\.generateBriefing\(/);
  assert.match(home, /external\.mutate\(/);
  assert.match(home, /allowExternal: true/);
  assert.doesNotMatch(home, /<AssistantCard title="할 일"/);
  assert.doesNotMatch(home, /<AssistantCard title="집중 시간"/);
});
