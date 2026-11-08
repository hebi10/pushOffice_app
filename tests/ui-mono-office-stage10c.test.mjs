import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const tokens = read('src/lib/designTokens.ts');
const shared = read('src/components/AssistantUI.tsx');
const settings = read('src/components/settings/SettingsUI.tsx');
const dialog = read('src/components/ui/AppDialog.tsx');
const intro = read('src/components/ui/ScreenIntro.tsx');
const brand = read('src/components/ui/AppBrandHeader.tsx');
const theme = read('src/lib/theme.ts');

function palette(name) {
  const body = theme.match(new RegExp('export const ' + name + ': AppColors = \\{([\\s\\S]*?)\\n\\};'))?.[1];
  assert.ok(body, 'Missing palette ' + name);
  return Object.fromEntries([...body.matchAll(/(\w+): '(#[0-9a-fA-F]{6})'/g)].map(([, k, v]) => [k, v]));
}

function luminance(hex) {
  const linear = [1, 3, 5].map(i => {
    const n = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('10-C simplifies radii without shadows while preserving touch dimensions', () => {
  for (const value of ['field: 6', 'button: 8', 'card: 10', 'dialog: 10']) assert.ok(tokens.includes(value));
  assert.match(tokens, /controlMinHeight: 50/);
  assert.match(tokens, /touchMinHeight: 48/);
  for (const source of [shared, settings, dialog, intro, brand]) {
    assert.doesNotMatch(source, /shadowColor|shadowOffset|shadowOpacity|elevation:\s*\d|linear-gradient/);
  }
});

test('10-C shared primary, secondary, destructive and disabled controls retain contrast and state', () => {
  assert.match(shared, /variant\?: AssistantButtonVariant/);
  assert.match(shared, /resolved = variant \?\? \(secondary \? 'secondary' : 'primary'\)/);
  assert.match(shared, /const foreground = disabled/);
  assert.match(shared, /const background = disabled/);
  assert.match(shared, /backgroundColor: background/);
  assert.match(shared, /borderColor: border/);
  assert.match(shared, /accessibilityState=\{\{ disabled: inactive, busy \}\}/);
  assert.match(shared, /<ActivityIndicator color=\{foreground\} \/>/);
  for (const mode of ['lightColors', 'darkColors']) {
    const c = palette(mode);
    for (const [bg, fg] of [['primary', 'onPrimary'], ['surface', 'text'], ['danger', 'onDanger'], ['inputBackground', 'textSecondary']]) {
      assert.ok(contrast(c[bg], c[fg]) >= 4.5, mode + ': ' + fg + '/' + bg);
    }
    assert.ok(contrast(c.inputBorder, c.surface) >= 3, mode + ': secondary boundary');
    assert.ok(contrast(c.inputBorder, c.inputBackground) >= 3, mode + ': input boundary');
  }
});

test('10-C text fields, settings groups, status text and switches share neutral roles', () => {
  assert.match(shared, /backgroundColor: colors\.inputBackground/);
  assert.match(shared, /borderColor: colors\.inputBorder/);
  assert.match(shared, /accessibilityLabel=\{label\}/);
  assert.match(settings, /<View style=\{styles\.iconBox\}>/);
  assert.match(settings, /<View style=\{\[styles\.groupHeader, \{ backgroundColor: colors\.surface \}\]\}>/);
  assert.match(settings, /backgroundColor: colors\.inputBackground/);
  assert.match(settings, /accessibilityValue=\{status \? \{ text: status \} : undefined\}/);
  assert.match(settings, /accessibilityRole="radio"/);
  assert.match(settings, /accessibilityState=\{\{ checked: selected \}\}/);
  for (const source of [shared, settings]) {
    assert.match(source, /trackColor=\{\{ false: colors\.inputBorder, true: colors\.primaryLight \}\}/);
    assert.match(source, /thumbColor=\{value \? colors\.primary : colors\.surfaceBorder\}/);
  }
});

test('10-C dialog retains scroll, destructive meaning and accessible cancellation', () => {
  assert.match(dialog, /onRequestClose=\{onDismiss\}/);
  assert.match(dialog, /accessibilityViewIsModal/);
  assert.match(dialog, /ScrollView style=\{styles\.messageScroll\}/);
  assert.match(dialog, /destructive \? colors\.danger : colors\.primary/);
  assert.match(dialog, /destructive \? colors\.onDanger : colors\.onPrimary/);
  assert.match(dialog, /backgroundColor: colors\.surface, borderColor: colors\.inputBorder/);
  assert.match(dialog, /showCancel \?/);
  assert.match(dialog, /onPress=\{onConfirm\}/);
  assert.match(dialog, /onPress=\{onDismiss\}/);
});

test('10-C preserves existing mono brand and intro artwork in both themes', () => {
  assert.match(brand, /push-office-mark\.png/);
  assert.match(brand, /tintColor: colors\.primary/);
  assert.match(brand, /accessibilityLabel="알림 설정으로 이동"/);
  assert.match(intro, /monochromeArtwork \? \(/);
  assert.match(intro, /tintColor: colors\.primary/);
  assert.match(intro, /artwork && !compact && !isDark/);
  assert.match(intro, /compact && styles\.compactContainer/);
});
