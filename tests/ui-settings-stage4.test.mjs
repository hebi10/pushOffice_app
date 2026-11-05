import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const settings = source('app/(tabs)/settings.tsx');
const ui = source('src/components/settings/SettingsUI.tsx');
const capture = source('tools/ui/capture_android.py');

test('PO-UI-04 keeps the basic and advanced settings hierarchy from the guide', () => {
  for (const label of [
    '알림과 아침 브리핑',
    '빠른 설정과 홈 위젯',
    '기기 내 음성과 AI',
    '선택한 외부 정보',
    '이전 일정 가져오기',
    '화면과 보관',
    '개인정보와 지원',
  ]) assert.ok(settings.includes(label), 'Missing settings group: ' + label);
  assert.match(settings, /section === 'basic'/);
  assert.match(settings, /accessibilityRole="tab"/);
  assert.match(settings, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(settings, /<SettingsToggleRow/);
  assert.match(settings, /<SettingsActionRow/);
  assert.match(settings, /<SettingsChoiceRow/);
  assert.match(settings, /<SettingsStatusRow/);
});

test('PO-UI-04 settings rows are accessible and support long descriptions', () => {
  assert.match(ui, /accessibilityRole="button"/);
  assert.match(ui, /accessibilityState=\{\{ disabled: busy, busy, expanded \}\}/);
  assert.match(ui, /accessibilityLabel=\{title\}/);
  assert.match(ui, /accessibilityRole="radio"/);
  assert.match(ui, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(ui, /accessibilityLabel=\{title\}/);
  assert.match(ui, /minWidth: 0/);
  assert.match(ui, /minHeight: 56/);
  assert.match(ui, /colors\.surfaceBorder/);
});

test('PO-UI-04 preserves saved notification and digest settings and permission flow', () => {
  for (const field of [
    'pushEnabled: v',
    'dailyBriefingEnabled: v',
    'dailyBriefingTime: { hour: h, minute: m }',
    'digestTypes: { ...settings.digestTypes, weather: v }',
    'digestTypes: { ...settings.digestTypes, news: v }',
    'digestTypes: { ...settings.digestTypes, stocks: v }',
    'digestCity: city.trim()',
    'newsKeywords: keywords.split',
    'newsLanguage: language.trim()',
    'stockTickers: tickers.split',
  ]) assert.ok(settings.includes(field), 'Missing existing settings action: ' + field);
  assert.match(settings, /saveAssistantSettings\(patch\)/);
  assert.match(settings, /requestNotificationPermission\(\)/);
  assert.match(settings, /reminderCapabilities\(\)/);
  assert.match(settings, /PushOfficeNative\.requestAddTile\(\)/);
  assert.match(settings, /PushOfficeNative\.requestPinWidget\(kind\)/);
});

test('PO-UI-04 preserves recovered data, native theme sync and consent-only voice', () => {
  assert.match(settings, /retryLegacyRecovery\(\)/);
  assert.match(settings, /recovering/);
  assert.match(settings, /themeMode: 'system'/);
  assert.match(settings, /themeMode: 'light'/);
  assert.match(settings, /themeMode: 'dark'/);
  assert.match(settings, /PushOfficeNative\.openQuickEntry\(\)/);
  assert.match(settings, /setNotice\(\{ title: '설정 저장 실패'/);
  assert.match(settings, /<AppDialog/);
  const nativeSettings = source('src/features/storage/nativeSettings.ts');
  assert.match(nativeSettings, /PushOfficeNative\.setUiTheme\(settings\.themeMode\)/);
});

test('PO-UI-04 visual capture includes expanded external options and dark theme settings', () => {
  assert.match(capture, /04a-settings-external-fields/);
  assert.match(capture, /04b-settings-advanced-dark/);
  assert.match(capture, /03b-settings-basic-dark/);
});
