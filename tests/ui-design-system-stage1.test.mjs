import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function getPalette(name) {
  const content = source('src/lib/theme.ts');
  const body = content.match(new RegExp(`export const ${name}: AppColors = \\{([\\s\\S]*?)\\n\\};`))?.[1];
  assert.ok(body, `Missing ${name} palette`);
  return Object.fromEntries(
    Array.from(body.matchAll(/([A-Za-z]+): '(#[0-9a-fA-F]{6})'/g), ([, key, value]) => [key, value]),
  );
}

function luminance(hex) {
  const channel = (n) => {
    const value = parseInt(hex.slice(n, n + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}

function contrast(a, b) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

test('light/dark primary, destructive and helper text remain legible', () => {
  for (const name of ['lightColors', 'darkColors']) {
    const colors = getPalette(name);
    const pairs = [
      ['primary', 'onPrimary'],
      ['danger', 'onDanger'],
      ['surface', 'text'],
      ['surface', 'textSecondary'],
    ];
    for (const [background, foreground] of pairs) {
      const score = contrast(colors[background], colors[foreground]);
      assert.ok(score >= 4.5, `${name}: ${foreground}/${background} contrast only ${score.toFixed(2)}:1`);
    }
  }
});

test('brand accent is distinct from accessible primary action color', () => {
  const light = getPalette('lightColors');
  assert.equal(light.brandAccent, '#4B94DC');
  assert.equal(light.primary, '#2563EB');
  assert.ok(contrast(light.brandAccent, '#FFFFFF') < 4.5);
});

test('shared components use the same spacing, control and typography tokens', () => {
  const t = source('src/lib/designTokens.ts');
  const ui = source('src/components/AssistantUI.tsx');
  const card = source('src/components/Card.tsx');
  const dialog = source('src/components/ui/AppDialog.tsx');
  assert.match(t, /controlMinHeight: 50/);
  assert.match(t, /touchMinHeight: 48/);
  assert.match(ui, /export function SettingRow/);
  assert.match(ui, /export function AssistantTextField/);
  assert.match(ui, /variant\?: AssistantButtonVariant/);
  assert.match(ui, /uiSizes\.controlMinHeight/);
  assert.match(card, /uiSizes\.cardPadding/);
  assert.match(dialog, /uiSizes\.dialogMaxWidth/);
  assert.match(dialog, /colors\.onDanger/);
});

test('settings and schedule details preserve existing actions via common controls', () => {
  const settings = source('app/(tabs)/settings.tsx');
  const detail = source('app/schedule/[id].tsx');
  assert.match(settings, /<SettingRow title=\{label\}/);
  assert.match(settings, /<AssistantTextField/);
  assert.match(detail, /<SettingRow title="하루 종일"/);
  assert.match(detail, /<SettingRow title="일정 알림"/);
  assert.match(detail, /<AssistantTextField/);
  assert.match(settings, /saveAssistantSettings\(patch\)/);
  assert.match(detail, /await update\.mutateAsync/);
});

test('font map does not advertise non-existent bundled font families to the runtime', () => {
  const theme = source('src/lib/theme.ts');
  assert.doesNotMatch(theme, /regular: 'Pretendard-Regular'/);
  assert.match(theme, /regular: APP_FONT_FAMILY/);
});
