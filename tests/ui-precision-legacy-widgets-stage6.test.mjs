import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const briefing = read('app/(tabs)/briefing.tsx');
const history = read('app/(tabs)/chatHistory.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const views = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleWidgetViews.kt');
const widgets = ['widget_small', 'widget_agenda'].map(name =>
  read('modules/push-office-native/android/src/main/res/layout/' + name + '.xml'));
const action = read('modules/push-office-native/android/src/main/res/drawable/widget_primary_action_background.xml');
const captures = read('tools/ui/capture_android.py');
const required = read('tools/ui/verify_captures.py');

test('precision stage 6 uses the compact shared introduction for preserved screens only', () => {
  assert.match(briefing, /title="데일리 다이제스트"[\s\S]*?compact/);
  assert.match(history, /title="채팅 내역"[^>]*compact/);
  assert.match(history, /description="일정 등록·변경 내역을 확인하세요\."[\s\S]*?compact/);
  assert.match(briefing, /paddingTop: uiSpacing\.sm/);
  assert.match(briefing, /headerLeft: \{ flex: 1, minWidth: 0 \}/);
  assert.match(history, /timeText: \{ \.\.\.uiTypography\.caption, fontSize: 11/);
  assert.match(history, /bubbleText: \{ \.\.\.uiTypography\.body, fontSize: 14/);
  assert.match(history, /기록된 일정 대화가 생기면/);
  assert.match(tabs, /name="briefing"[\s\S]*?href: null/);
  assert.match(tabs, /name="chatHistory"[\s\S]*?href: null/);
});

test('precision stage 6 preserves legacy briefing and chat actions without inventing features', () => {
  for (const a of [
    'useDateDigest(targetDate)',
    'generateMutation.mutate({ input: buildInput() })',
    'force: true',
    'await Share.share',
    'await Clipboard.setStringAsync',
    'accessibilityLabel="브리핑 새로고침"',
    'accessibilityLabel="브리핑 공유하기"',
    'accessibilityLabel="브리핑 복사하기"',
    'colors.onPrimary',
  ]) assert.ok(briefing.includes(a), 'Missing briefing behavior ' + a);
  for (const a of [
    'useChatHistory()',
    'cancelNotification(',
    'await deleteMutation.mutateAsync',
    'await updateChatMsg.mutateAsync',
    'accessibilityLabel="일정 수정"',
    'accessibilityLabel="일정 취소"',
    'label="다시 불러오기"',
    'minHeight: uiSizes.touchMinHeight',
  ]) assert.ok(history.includes(a), 'Missing chat behavior ' + a);
});

test('precision stage 6 uses one shared brand and clear widget action hierarchy', () => {
  assert.match(views, /measure\(context, "PushOffice", 10f/);
  for (const widget of widgets) {
    assert.match(widget, /android:text="PushOffice"/);
    assert.match(widget, /@drawable\/widget_background/);
    assert.match(widget, /@drawable\/widget_primary_action_background/);
    assert.match(widget, /@drawable\/widget_action_background/);
    assert.match(widget, /@color\/po_widget_on_primary/);
    assert.match(widget, /@color\/po_widget_accent/);
    assert.match(widget, /android:contentDescription="텍스트로 일정 입력"/);
    assert.match(widget, /android:contentDescription="음성 입력 선택 화면 열기"/);
    assert.match(widget, /android:layout_height="48dp"/);
  }
  assert.match(action, /@color\/po_widget_accent/);
  assert.match(action, /android:radius="10dp"/);
});

test('precision stage 6 widget primary button has adequate contrast in both themes', () => {
  const colors = [
    { mode: 'values', background: '#23262B', text: '#FFFFFF' },
    { mode: 'values-night', background: '#E7E9EC', text: '#111315' },
  ];
  const linear = v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = hex => {
    const c = [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16)));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const contrast = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const { mode, background, text } of colors) {
    const xml = read('modules/push-office-native/android/src/main/res/' + mode + '/colors.xml');
    assert.ok(xml.includes('<color name="po_widget_accent">' + background + '</color>'));
    assert.ok(xml.includes('<color name="po_widget_on_primary">' + text + '</color>'));
    assert.ok(contrast(background, text) >= 4.5, mode + ': contrast below 4.5:1');
  }
});

test('precision stage 6 preserves existing widget click routes and dynamic event content', () => {
  for (const action of [
    'setOnClickPendingIntent(row,',
    'eventIntent(context, event.id)',
    'entryIntent(context, "chooser")',
    'entryIntent(context, "text")',
    'entryIntent(context, "voice")',
    'pushofficeapp://schedule/',
    'setContentDescription(row,',
    'capacity',
  ]) assert.ok(views.includes(action), 'Missing widget behavior ' + action);
});

test('precision stage 6 audits existing launcher, adaptive, splash and header image sources', () => {
  const expo = JSON.parse(read('app.json')).expo;
  const images = [
    expo.icon,
    expo.android.adaptiveIcon.foregroundImage,
    expo.android.adaptiveIcon.monochromeImage,
    expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].image,
    expo.web.favicon,
  ];
  assert.ok(images.every(p => p.startsWith('./assets/images/push-office-')));
  for (const p of images) assert.ok(existsSync(new URL('../' + p, import.meta.url)), 'Missing asset ' + p);
  assert.match(read('src/components/ui/AppBrandHeader.tsx'), /assets\/images\/push-office-mark\.png/);
  assert.match(read('src/components/ui/AppBrandHeader.tsx'), /PushOffice/);
});

test('precision stage 6 requires actual Android deep-link screenshots of preserved routes', () => {
  for (const name of ['18-legacy-briefing', '19-legacy-chat-history']) {
    assert.ok(captures.includes(name), 'Missing capture request ' + name);
    assert.ok(required.includes(name + '.png'), 'Missing required image ' + name);
  }
  assert.match(captures, /pushofficeapp:\/\//);
  assert.match(captures, /capture_preserved_route\("briefing", "데일리 다이제스트"/);
  assert.match(captures, /capture_preserved_route\("chatHistory", "채팅 내역"/);
});
