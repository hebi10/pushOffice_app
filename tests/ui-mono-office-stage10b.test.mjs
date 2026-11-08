import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const brand = read('src/components/ui/AppBrandHeader.tsx');
const signIn = read('app/(auth)/sign-in.tsx');
const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');

test('10-B loads the same flat calendar artwork in light and dark', () => {
  assert.match(home, /illustration-home-mono\.png/);
  assert.match(home, /monochromeArtwork/);
  assert.doesNotMatch(home, /illustration-home\.jpg/);
  assert.match(intro, /monochromeArtwork \? \(/);
  assert.match(intro, /tintColor: colors\.primary/);
  assert.match(intro, /artwork && !compact && !isDark/);
  assert.match(intro, /featured && styles\.featuredArtwork/);
});

test('10-B brandmark uses semantic tint and accessible preserved labels', () => {
  assert.match(brand, /push-office-mark\.png/);
  assert.match(signIn, /push-office-mark\.png/);
  assert.match(brand, /accessibilityLabel="Push Office"/);
  assert.match(signIn, /accessibilityLabel="Push Office 앱 아이콘"/);
  assert.match(brand, /tintColor: colors\.primary/);
  assert.match(home, /label="일정 빠르게 추가"/);
  assert.match(home, /openVoiceQuickEntry/);
});

test('10-B native quick entry illustration is available in both system themes', () => {
  assert.match(native, /R\.drawable\.quick_entry_mono/);
  assert.doesNotMatch(native, /if \(!isDark\) root\.addView\(ImageView/);
  assert.match(native, /View\.IMPORTANT_FOR_ACCESSIBILITY_NO/);
});
