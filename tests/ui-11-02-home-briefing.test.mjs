import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('UI-11-02 prioritizes next schedule, concise daily briefing and full agenda before optional notifications', () => {
  const expectedOrder = [
    'label="일정 빠르게 추가"',
    'title="다음 일정"',
    'title="오늘의 브리핑"',
    'title="오늘 일정"',
    'title="알림에서 일정 추천"',
    'title="확인할 일정 추천"',
    'title="외부 브리핑"',
  ];
  const positions = expectedOrder.map(name => home.indexOf(name));
  assert.ok(positions.every(position => position >= 0), 'A home section is missing');
  assert.ok(positions.every((position, i) => i === 0 || position > positions[i - 1]),
    'A notification or marketing section obscures the daily schedules');
  assert.match(home, /todayItems\.map\(/);
  assert.match(home, /<ScheduleItem/);
  assert.match(home, /title="오늘 일정"/);
  assert.match(home, /router\.push\('\/\(tabs\)\/calendar'\)/);
});

test('UI-11-02 shortens only the home hero while preserving monochrome artwork', () => {
  assert.match(home, /monochromeArtwork\s+dense\s+featured\s*\/>/);
  assert.match(intro, /dense = false/);
  assert.match(intro, /dense && styles\.denseContainer/);
  assert.match(intro, /dense && styles\.denseArtwork/);
  assert.match(intro, /denseContainer: \{ minHeight: 82/);
  assert.match(intro, /denseArtwork: \{ width: 90, height: 78 \}/);
  assert.match(home, /description="중요한 일정부터 하나씩 살펴보세요\."/);
});

test('UI-11-02 shows one real appointment count without repeating the first title', () => {
  assert.match(home, /오늘 일정 \$\{todayItems\.length\}건을 시간순으로 확인하세요\./);
  assert.doesNotMatch(home, /styles\.countPill/);
  assert.doesNotMatch(home, /const firstToday/);
  assert.match(home, /const summary =/);
  assert.match(home, /todayItems\.map\(x =>/);
  assert.match(home, /refined \|\| todayHeadline/);
  assert.match(home, /ai\.status === 'available'/);
  assert.match(home, /PushOfficeNative\.generateBriefing\(/);
  assert.match(home, /runForegroundRequest\(/);
});

test('UI-11-02 keeps sensitive notification disclosure and explicit user approval', () => {
  assert.match(home, /다른 앱의 민감한 알림 내용도 읽을 수 있습니다/);
  assert.match(home, /직접 승인해야 저장됩니다/);
  assert.match(home, /accessibilityLabel="알림 분석 안내 및 이용 설정"/);
  assert.match(home, /onPress=\{\(\) => setShowNotificationDisclosure\(true\)\}/);
  assert.match(home, /title="다른 앱 알림 접근 안내"/);
  assert.match(home, /인증번호 등 민감한 정보도 이 권한의 범위에 포함됩니다/);
  assert.match(home, /PushOfficeNative\.openNotificationAccessSettings\(\)/);
  assert.match(home, /PushOfficeNative\.getNotificationSuggestions\(\)/);
  assert.match(home, /PushOfficeNative\.getNotificationSuggestionStatus\(\)/);
  assert.match(home, /notificationSuggestions\.slice\(0, 3\)/);
  assert.match(home, /reviewSuggestion\(item\.id\)/);
  assert.match(home, /declineSuggestion\(item\.id\)/);
});

test('UI-11-02 retains existing true data, notification state and manual network boundary', () => {
  assert.match(home, /nextSchedule\(/);
  assert.match(home, /nextEndAt\.getTime\(\) > nextAt\.getTime\(\)/);
  assert.match(home, /next\.repeatType === 'monthly'/);
  assert.match(home, /next\.repeatType === 'yearly'/);
  assert.match(home, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(home, /PushOfficeNative\.openVoiceQuickEntry\(\)/);
  assert.match(home, /external\.mutate\(/);
  assert.match(home, /allowExternal: true/);
  assert.doesNotMatch(home, /<AssistantCard title="할 일"/);
  assert.doesNotMatch(home, /<AssistantCard title="집중 시간"/);
  for (const name of ['01-home', '10-home-dark', '22a-home-today-one', '22b-home-today-three', '20a-large-font-home', '21a-tablet-home']) {
    assert.ok(capture.includes('"'+name+'"'), 'Missing real Android capture scenario '+name);
    assert.ok(verify.includes('"'+name+'.png"'), 'Required QA screenshot missing '+name);
  }
});
