import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const briefing = source('app/(tabs)/briefing.tsx');
const history = source('app/(tabs)/chatHistory.tsx');
const widgetSmall = source('modules/push-office-native/android/src/main/res/layout/widget_small.xml');
const widgetAgenda = source('modules/push-office-native/android/src/main/res/layout/widget_agenda.xml');
const widgetNight = source('modules/push-office-native/android/src/main/res/values-night/colors.xml');
const theme = source('src/lib/theme.ts');

test('PO-UI-07 keeps legacy briefing generation, refresh, sharing, copying and readable action contrast', () => {
  assert.match(briefing, /<ScreenIntro/);
  assert.match(briefing, /useDateDigest\(targetDate\)/);
  assert.match(briefing, /generateMutation\.mutate\(\{ input: buildInput\(\) \}\)/);
  assert.match(briefing, /force: true/);
  assert.match(briefing, /await Share\.share/);
  assert.match(briefing, /await Clipboard\.setStringAsync/);
  assert.match(briefing, /colors\.onPrimary/);
  assert.doesNotMatch(briefing, /isDark \? colors\.background : '#FFF'/);
  for (const label of ['브리핑 새로고침', '브리핑 다시 불러오기', '브리핑 재생성', '브리핑 공유하기', '브리핑 복사하기', '브리핑 생성하기']) {
    assert.ok(briefing.includes('accessibilityLabel="' + label + '"'), label);
  }
  assert.match(briefing, /minHeight: uiSizes\.touchMinHeight/);
});

test('PO-UI-07 keeps schedule actions in chat history with accessible touch targets and explicit failed state', () => {
  assert.match(history, /<ScreenIntro/);
  assert.match(history, /isError && !messages\?\.length/);
  assert.match(history, /label="다시 불러오기"/);
  assert.match(history, /useChatHistory\(\)/);
  assert.match(history, /cancelNotification\(/);
  assert.match(history, /await deleteMutation\.mutateAsync/);
  assert.match(history, /await updateChatMsg\.mutateAsync/);
  assert.match(history, /router\.push\(\x60\/schedule\/\$\{msg\.scheduleId\}\x60\)/);
  assert.match(history, /accessibilityLabel="일정 수정"/);
  assert.match(history, /accessibilityLabel="일정 취소"/);
  assert.match(history, /minHeight: uiSizes\.touchMinHeight/);
});

test('PO-UI-07 uses the same dark surfaces, accent and text palette in both widget sizes', () => {
  for (const widget of [widgetSmall, widgetAgenda]) {
    assert.match(widget, /@drawable\/widget_background/);
    assert.match(widget, /@drawable\/widget_action_background/);
    assert.match(widget, /@color\/po_widget_accent/);
    assert.match(widget, /android:contentDescription="텍스트로 일정 입력"/);
    assert.match(widget, /android:contentDescription="음성 입력 선택 화면 열기"/);
  }
  for (const [name, themeName] of [
    ['po_widget_surface', 'surface'],
    ['po_widget_text', 'text'],
    ['po_widget_accent', 'primary'],
    ['po_widget_border', 'surfaceBorder'],
    ['po_widget_action_surface', 'inputBackground'],
  ]) {
    const color = new RegExp('<color name="' + name + '">(#(?:[0-9A-Fa-f]{6}))<\\/color>').exec(widgetNight)?.[1];
    assert.ok(color, 'Missing Android widget color: ' + name);
    const value = new RegExp('(?:^|\\n)  ' + themeName + ': \\' + color + \\'', 'm');
    assert.ok(value.test(theme), name + ' does not match a design theme color');
  }
});
