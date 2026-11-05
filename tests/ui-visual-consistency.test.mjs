import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('native quick entry presents branded choices without legacy list dialogs', () => {
  const native = source('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
  assert.match(native, /showBrandedDialog\("변경할 일정을 선택해 주세요"/);
  assert.match(native, /showBrandedDialog\(/);
  assert.doesNotMatch(native, /\.setItems\(candidates/);
  assert.match(native, /pairedButtons\("기기 AI로 해석"/);
});

test('both widget layouts have day and night palette references', () => {
  for (const name of ['widget_small', 'widget_agenda']) {
    const layout = source(`modules/push-office-native/android/src/main/res/layout/${name}.xml`);
    assert.match(layout, /@color\/po_widget_text/);
    assert.match(layout, /@color\/po_widget_accent/);
  }
  for (const type of ['values', 'values-night']) {
    const palette = source(`modules/push-office-native/android/src/main/res/${type}/colors.xml`);
    for (const key of ['po_widget_surface', 'po_widget_text', 'po_widget_accent', 'po_widget_border']) {
      assert.ok(palette.includes(`name="${key}"`), `Missing ${type} ${key}`);
    }
  }
});

test('all retained app routes use the same heading or dialog components', () => {
  for (const page of ['briefing', 'chatHistory', 'calendar', 'index', 'settings']) {
    const route = source(`app/(tabs)/${page}.tsx`);
    assert.match(route, /ScreenIntro/);
  }
  const detail = source('app/schedule/[id].tsx');
  assert.match(detail, /AppDialog/);
  const auth = source('src/features/auth/useAuthInit.ts');
  const permission = source('src/features/notifications/permission.ts');
  assert.match(auth, /showNotice/);
  assert.match(permission, /showNotice/);
});
