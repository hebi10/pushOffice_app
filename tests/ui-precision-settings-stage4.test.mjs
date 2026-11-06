import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const settings = source('app/(tabs)/settings.tsx');
const rows = source('src/components/settings/SettingsUI.tsx');
const dialog = source('src/components/ui/AppDialog.tsx');
const capture = source('tools/ui/capture_android.py');
const verify = source('tools/ui/verify_captures.py');

test('precision stage 4 keeps two settings tabs and reduces header-only repetition', () => {
  assert.match(settings, /section === 'basic'/);
  assert.match(settings, /accessibilityRole="tablist"/);
  assert.match(settings, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(settings, /value === 'basic' \? 'settings-outline' : 'options-outline'/);
  for (const title of ['알림과 아침 브리핑', '빠른 설정과 홈 위젯', '기기 내 음성과 AI', '선택한 외부 정보', '화면과 보관', '개인정보와 지원']) {
    assert.ok(settings.includes(title), 'Missing setting section: ' + title);
  }
});

test('precision stage 4 shows concise sections with accessible status and selected options', () => {
  assert.match(rows, /paddingHorizontal: uiSpacing\.sm,\s*paddingVertical: uiSpacing\.xs/);
  assert.match(rows, /groupContent: \{ paddingHorizontal: uiSpacing\.xs, paddingVertical: uiSpacing\.xxs, gap: 0 \}/);
  assert.match(rows, /minHeight: 56/);
  assert.match(rows, /width: 34,\s*height: 34/);
  assert.match(rows, /statusBadge/);
  assert.match(rows, /accessibilityValue=\{status \? \{ text: status \} : undefined\}/);
  assert.match(rows, /accessibilityRole="radio"/);
  assert.match(rows, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(rows, /accessibilityLabel=\{title\}/);
});

test('precision stage 4 keeps save/permissions/widget/native AI/private data flows', () => {
  for (const action of [
    'saveAssistantSettings(patch)',
    'requestNotificationPermission()',
    'PushOfficeNative.requestAddTile()',
    'PushOfficeNative.requestPinWidget(kind)',
    'PushOfficeNative.getAiStatus()',
    'PushOfficeNative.openQuickEntry()',
    'retryLegacyRecovery()',
    "themeMode: 'dark'",
    "themeMode: 'light'",
    "themeMode: 'system'",
    "Linking.openURL('https://hebi10.github.io/pushOffice_app/privacy/')",
  ]) assert.ok(settings.includes(action), 'Missing original operation: ' + action);
  assert.match(settings, /newsKeywords: keywords\.split/);
  assert.match(settings, /stockTickers: tickers\.split/);
  assert.match(settings, /digestTypes: \{ \.\.\.settings\.digestTypes, stocks: v \}/);
});

test('precision stage 4 aligns title and icon inside one scroll-safe accessible modal', () => {
  assert.match(dialog, /<View style=\{styles\.heading\}>/);
  assert.match(dialog, /accessibilityRole="header"/);
  assert.match(dialog, /heading: \{ flexDirection: 'row', alignItems: 'center'/);
  assert.match(dialog, /width: 40,\s*height: 40/);
  assert.match(dialog, /maxHeight: '88%'/);
  assert.match(dialog, /maxWidth: uiSizes\.dialogMaxWidth/);
  assert.match(dialog, /accessibilityViewIsModal/);
  assert.match(dialog, /onRequestClose=\{onDismiss\}/);
  assert.match(dialog, /ScrollView style=\{styles\.messageScroll\}/);
  assert.match(dialog, /destructive \? colors\.onDanger : colors\.onPrimary/);
  assert.match(dialog, /minHeight: uiSizes\.touchMinHeight/);
  assert.match(dialog, /showCancel \?/);
});

test('precision stage 4 captures basic/advanced settings and actual save notice', () => {
  for (const name of [
    '03-settings',
    '03c-settings-time-expanded',
    '03d-settings-save-notice',
    '04-settings-advanced',
    '04a-settings-external-fields',
    '03b-settings-basic-dark',
    '04b-settings-advanced-dark',
  ]) {
    assert.ok(capture.includes(name), 'Missing capture path: ' + name);
    assert.ok(verify.includes(name + '.png') || name.startsWith('04a-'), 'Required capture verification missing: ' + name);
  }
  assert.match(capture, /if find\("설정 저장 완료"\) is None:/);
  assert.match(capture, /tap\("확인"\)/);
});
