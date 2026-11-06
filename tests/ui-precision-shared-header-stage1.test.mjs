import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const tabs = read('app/(tabs)/_layout.tsx');
const brand = read('src/components/ui/AppBrandHeader.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const tokens = read('src/lib/designTokens.ts');
const shared = read('src/components/AssistantUI.tsx');
const home = read('app/(tabs)/index.tsx');
const calendar = read('app/(tabs)/calendar.tsx');
const settings = read('app/(tabs)/settings.tsx');

test('precision stage 1 shows one branded header on every main tab without new tabs', () => {
  assert.match(tabs, /headerTitle: \(\) => <AppBrandHeader\s*\/>/);
  assert.match(tabs, /headerTitleAlign: 'left'/);
  assert.match(tabs, /headerShadowVisible: false/);
  assert.match(tabs, /name="index"/);
  assert.match(tabs, /name="calendar"/);
  assert.match(tabs, /name="settings"/);
  assert.match(tabs, /name="chatHistory"[\s\S]*?href: null/);
  assert.match(tabs, /name="briefing"[\s\S]*?href: null/);
  assert.doesNotMatch(tabs, /name="(?:todos|tasks|focus|profile|ai)"/);
  assert.match(brand, /assets\/images\/push-office-icon\.png/);
  assert.match(brand, /PushOffice/);
  assert.match(brand, /accessibilityRole="header"/);
});

test('notification icon is a working shortcut to existing settings, not an inert notification inbox', () => {
  assert.match(tabs, /headerRight: \(\) => <NotificationSettingsAction\s*\/>/);
  assert.match(tabs, /name="settings"[\s\S]*?headerRight: \(\) => null/);
  assert.match(brand, /accessibilityRole="button"/);
  assert.match(brand, /accessibilityLabel="알림 설정으로 이동"/);
  assert.match(brand, /router\.navigate\('\/\(tabs\)\/settings'\)/);
  assert.match(brand, /uiSizes\.touchMinHeight/);
});

test('screen introductions use compact shared typography and artwork spacing', () => {
  assert.match(tokens, /brandMark: 32/);
  assert.match(tokens, /introMinHeight: 88/);
  assert.match(tokens, /introArtworkWidth: 88/);
  assert.match(tokens, /introArtworkHeight: 74/);
  assert.match(tokens, /screenTitle: \{ fontFamily: APP_FONT_FAMILY, fontSize: 25, lineHeight: 32/);
  assert.match(intro, /minHeight: uiSizes\.introMinHeight/);
  assert.match(intro, /width: uiSizes\.introArtworkWidth/);
  assert.match(intro, /height: uiSizes\.introArtworkHeight/);
  assert.match(intro, /artwork && !isDark/);
  assert.match(shared, /paddingTop: uiSpacing\.sm/);
  assert.match(shared, /gap: uiSpacing\.sm/);
});

test('main screens keep their page introductions without duplicating the brand label', () => {
  for (const screen of [home, calendar, settings]) {
    assert.match(screen, /<ScreenIntro/);
  }
  assert.match(home, /eyebrow="로컬 일정 비서"/);
  assert.match(calendar, /eyebrow="날짜별 일정"/);
  assert.match(settings, /eyebrow="환경 설정"/);
  assert.doesNotMatch(home, /eyebrow="PUSH OFFICE/);
  assert.doesNotMatch(calendar, /eyebrow="PUSH OFFICE/);
  assert.doesNotMatch(settings, /eyebrow="PUSH OFFICE/);
  assert.match(home, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(calendar, /onDayPress=/);
  assert.match(settings, /saveAssistantSettings\(patch\)/);
});
