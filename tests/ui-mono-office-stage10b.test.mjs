import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/(tabs)/index.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const brand = read('src/components/ui/AppBrandHeader.tsx');

test('10-B home hero uses a neutral flat system icon in both light and dark', () => {
  assert.match(home, /graphicIcon="calendar-outline"/);
  assert.doesNotMatch(home, /illustration-home\.jpg/);
  assert.match(intro, /graphicIcon && !compact/);
  assert.match(intro, /color=\{colors\.primary\}/);
  assert.match(intro, /featured && styles\.featuredGraphic/);
  assert.doesNotMatch(intro, /shadowColor|elevation:|linear-gradient/);
});

test('10-B preserves other intro artwork fallback and existing installed app branding', () => {
  assert.match(intro, /artwork && !compact && !isDark/);
  assert.match(brand, /push-office-icon\.png/);
  assert.match(brand, /accessibilityLabel="Push Office"/);
  assert.match(home, /label="일정 빠르게 추가"/);
  assert.match(home, /openVoiceQuickEntry/);
});
