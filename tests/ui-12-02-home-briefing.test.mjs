import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const digest = read('src/features/digest/digestWorkflow.ts');
const settings = read('src/store/slices/settingsSlice.ts');
const header = read('src/components/ui/AppBrandHeader.tsx');

test('UI-12-02 does not repeat the next event in the local AI prompt or today list', () => {
  assert.ok(home.includes('const nextIsInTodayAgenda = Boolean(next?.id && todayItems.some('));
  assert.ok(home.includes('item.id === next.id && item.startAt.toMillis() === next.startAt.toMillis()'));
  assert.ok(home.includes('next && !nextIsInTodayAgenda ?'));
  assert.ok(home.includes('nextIsInTodayAgenda && item.id === next?.id && item.startAt.toMillis() === next?.startAt.toMillis()'));
  assert.ok(home.includes('다음 일정 1건은 위 카드에서 확인하세요.'));
  assert.ok(home.includes('title="오늘 일정"'));
  assert.ok(home.includes('todayItems.map((item, index) =>'));
  assert.ok(home.includes('router.push(\'/(tabs)/calendar\')'));
  assert.ok(home.includes('일정을 불러오지 못했습니다. 다시 확인해 주세요.'));
});

test('UI-12-02 guards optional network requests and never renders stale external data', () => {
  assert.ok(home.includes('ENV.FUNCTIONS_BASE_URL.trim()'));
  assert.ok(home.includes('const externalTypesSelected = settings.digestTypes.weather || settings.digestTypes.news || settings.digestTypes.stocks'));
  assert.ok(home.includes('const externalCanRequest = externalTypesSelected && externalServiceConfigured;'));
  assert.ok(home.includes('external.isSuccess && external.variables?.input.dateKey === today'));
  assert.ok(home.includes('{externalCanRequest ? ('));
  assert.ok(home.includes('label="외부 정보 설정"'));
  assert.ok(home.includes('!externalServiceConfigured'));
  assert.ok(home.includes('외부 브리핑 서비스가 연결되지 않았습니다.'));
  assert.ok(home.includes('externalResultForToday && external.data?.weatherData'));
  assert.ok(home.includes('externalResultForToday && external.data?.newsData'));
  assert.ok(home.includes('externalResultForToday && external.data?.stockData'));
  assert.ok(home.includes('allowExternal: true'));
  assert.match(digest, /if \(input\.allowExternal\)/);
  for (const key of ['weather: false', 'stocks: false', 'news: false']) {
    assert.ok(settings.includes(key), 'Optional server content must remain opt-in: ' + key);
  }
});

test('UI-12-02 retains sensitive notification disclosure and existing app navigation', () => {
  assert.ok(home.includes('다른 앱의 민감한 알림 내용도 읽을 수 있습니다.'));
  assert.ok(home.includes('추천 일정은 직접 승인해야 저장됩니다.'));
  assert.ok(home.includes('onPress={() => setShowNotificationDisclosure(true)}'));
  assert.ok(home.includes('notificationSetupCopy: { width: \'100%\' }'));
  assert.ok(home.includes('alignSelf: \'flex-end\''));
  assert.ok(home.includes('reviewSuggestion(item.id)'));
  assert.ok(home.includes('declineSuggestion(item.id)'));
  assert.ok(header.includes('accessibilityLabel="알림 설정으로 이동"'));
  assert.doesNotMatch(header, /badge|unreadCount|unreadBadge/);
  for (const title of ['다음 일정', '오늘의 브리핑', '오늘 일정', '알림에서 일정 추천', '외부 브리핑']) {
    assert.ok(home.includes('title="' + title + '"'), title + ' was removed');
  }
});

test('UI-12-02 preserves local data, explicit recording and existing Mono Office tokens', () => {
  const tokens = read('src/lib/theme.ts');
  assert.ok(home.includes('PushOfficeNative.openVoiceQuickEntry()'));
  assert.ok(home.includes('PushOfficeNative.openQuickEntry()'));
  assert.ok(home.includes('PushOfficeNative.generateBriefing('));
  assert.ok(home.includes('runForegroundRequest('));
  assert.ok(home.includes('nextSchedule('));
  assert.ok(home.includes('<ScheduleItem'));
  for (const c of ['#F7F8FA', '#111315', '#23262B']) {
    assert.ok(tokens.includes(c));
  }
  assert.doesNotMatch(home, /<AssistantCard title="할 일"|<AssistantCard title="집중 시간"/);
});
