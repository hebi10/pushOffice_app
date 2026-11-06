import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
const bridge = read('modules/push-office-native/index.ts');
const editor = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('HOME-01 uses actual date, greeting and a home-only hero layout', () => {
  assert.ok(home.includes("eyebrow={dayjs(now).format('M월 D일 dddd')}"));
  assert.match(home, /description="중요한 일정부터 하나씩 살펴보세요\."/);
  assert.match(home, /illustration-home\.jpg/);
  assert.match(home, /featured\s*\/>/);
  assert.match(intro, /featured = false/);
  assert.match(intro, /featured && styles\.featuredContainer/);
  assert.match(intro, /featured && styles\.featuredArtwork/);
  assert.match(intro, /artwork && !compact && !isDark/);
});

test('HOME-02 preserves chooser and adds opt-in voice entry without auto recording', () => {
  assert.match(home, /label="일정 빠르게 추가"/);
  assert.match(home, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(home, /accessibilityLabel="음성 입력 바로 열기"/);
  assert.match(home, /PushOfficeNative\.openVoiceQuickEntry\(\)/);
  assert.match(native, /AsyncFunction\("openVoiceQuickEntry"\)/);
  assert.match(native, /putExtra\("entryMode","voice"\)/);
  assert.match(bridge, /openVoiceQuickEntry\(\): Promise<void>/);
  assert.match(bridge, /openVoiceQuickEntry: unavailable/);
  assert.match(editor, /if\(voice\) status\.text=/);
  assert.doesNotMatch(editor, /if\(voice\) beginSpeech\(/);
  assert.match(home, /uiSizes\.touchMinHeight/);
});

test('HOME-03 uses one count and first real appointment while hiding redundant empty card', () => {
  assert.match(home, /const firstToday = todayItems\[0\]/);
  assert.match(home, /sort\(\(a, b\) => a\.startAt\.toMillis\(\) - b\.startAt\.toMillis\(\)\)/);
  assert.match(home, /첫 일정/);
  assert.match(home, /firstToday\.isAllDay/);
  assert.match(home, /!schedules\.isLoading && !schedules\.isError && todayItems\.length > 0/);
  assert.match(home, /\(schedules\.isLoading \|\| schedules\.isError \|\| todayItems\.length > 0\) \? \(/);
  assert.match(home, /title="오늘 일정"/);
  assert.match(home, /'시간순 일정 목록'/);
  assert.match(home, /todayItems\.map\(/);
  assert.equal((home.match(/기기에 저장된 일정만으로 만든 요약/g) || []).length, 1);
  assert.doesNotMatch(home, /오늘 등록된 일정 /);
});

test('HOME-04 keeps real end time, repetition, detail navigation and data integrity', () => {
  assert.match(home, /nextSchedule\(/);
  assert.match(home, /nextEndAt\.getTime\(\) > nextAt\.getTime\(\)/);
  assert.match(home, /next\.repeatType === 'monthly'/);
  assert.match(home, /next\.repeatType === 'yearly'/);
  assert.match(home, /styles\.nextAccent/);
  assert.match(home, /router\.push\(/);
  assert.match(home, /<ScheduleItem/);
  assert.doesNotMatch(home, /<AssistantCard title="할 일"/);
  assert.doesNotMatch(home, /<AssistantCard title="집중 시간"/);
});

test('HOME-05 preserves AI, manual external retrieval and loading/error branches', () => {
  assert.match(home, /PushOfficeNative\.generateBriefing\(/);
  assert.match(home, /runForegroundRequest\(/);
  assert.match(home, /ai\.status === 'available'/);
  assert.match(home, /external\.mutate\(/);
  assert.match(home, /allowExternal: true/);
  assert.match(home, /title="외부 브리핑"/);
  assert.match(home, /schedules\.isLoading/);
  assert.match(home, /schedules\.isError/);
  assert.match(home, /refreshControl=\{<RefreshControl/);
});

test('HOME-06 captures real empty, single-event and three-event Android homes', () => {
  assert.match(capture, /screenshot\("01-home"/);
  assert.match(capture, /screenshot\("10-home-with-fixture"/);
  for (const name of ['22a-home-today-one', '22b-home-today-three']) {
    assert.ok(capture.includes(name), 'Missing home scenario ' + name);
    assert.ok(verify.includes(name + '.png'), 'Missing required image ' + name);
  }
  assert.match(capture, /if find\("3건"\) is None:/);
  assert.match(capture, /adb\("shell", "pm", "clear", APP\)/);
  assert.match(capture, /Populated home fixture:/);
});
