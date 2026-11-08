import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function getPalette(name) {
  const source = read('src/lib/theme.ts');
  const prefix = `export const ${name}: AppColors = {`;
  const start = source.indexOf(prefix);
  assert.ok(start >= 0, `Missing ${name} semantic palette`);
  const end = source.indexOf('\n};', start);
  assert.ok(end > start, `Unterminated ${name} semantic palette`);
  const body = source.slice(start + prefix.length, end);
  return Object.fromEntries(Array.from(
    body.matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g),
    ([, key, value]) => [key, value],
  ));
}

function luminance(hex) {
  const rgb = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const light = getPalette('lightColors');
const dark = getPalette('darkColors');

test('10-A applies neutral canvas, surface and primary action colors for both themes', () => {
  assert.equal(light.background, '#F7F8FA');
  assert.equal(light.surface, '#FFFFFF');
  assert.equal(light.primary, '#23262B');
  assert.equal(light.primaryLight, '#ECEEF1');
  assert.equal(dark.background, '#111315');
  assert.equal(dark.surface, '#1C1F22');
  assert.equal(dark.primary, '#E7E9EC');
  assert.equal(dark.primaryLight, '#292D31');
});

test('10-A preserves matching semantic roles without introducing new color consumers', () => {
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
  const source = read('src/lib/theme.ts');
  const roles = [...source.matchAll(/^\s+([a-zA-Z]+): string;/gm)].map(([, name]) => name);
  for (const role of roles) {
    assert.match(light[role], /^#[0-9a-fA-F]{6}$/, `Light role ${role}`);
    assert.match(dark[role], /^#[0-9a-fA-F]{6}$/, `Dark role ${role}`);
  }
  assert.match(source, /statusBar: 'dark',/);
  assert.match(source, /statusBar: 'light',/);
});

test('10-A keeps text and button labels at AA 4.5:1 across neutral backgrounds', () => {
  for (const [name, colors] of Object.entries({ light, dark })) {
    for (const background of ['background', 'surface', 'primaryLight', 'inputBackground']) {
      for (const foreground of ['text', 'textSecondary', 'textTertiary']) {
        const value = contrast(colors[background], colors[foreground]);
        assert.ok(value >= 4.5,
          `${name} ${foreground}/${background}: ${value.toFixed(2)}:1 < 4.5:1`);
      }
    }
    for (const [background, foreground] of [
      ['primary', 'onPrimary'], ['danger', 'onDanger'],
      ['chatUserBubble', 'chatUserText'], ['chatAssistantBubble', 'chatAssistantText'],
    ]) {
      const value = contrast(colors[background], colors[foreground]);
      assert.ok(value >= 4.5, `${name} ${foreground}/${background}: ${value.toFixed(2)}:1`);
    }
  }
});

test('10-A keeps 3:1 input outlines and accessible status/brand text', () => {
  for (const [name, colors] of Object.entries({ light, dark })) {
    for (const background of ['surface', 'inputBackground']) {
      assert.ok(contrast(colors.inputBorder, colors[background]) >= 3,
        `${name} input border on ${background} fails non-text contrast`);
    }
    for (const foreground of ['brandAccent', 'danger', 'success', 'primary']) {
      assert.ok(contrast(colors[foreground], colors.surface) >= 4.5,
        `${name} ${foreground}/surface fails normal-text contrast`);
    }
    assert.equal(colors.surfaceBorder, colors.divider);
    assert.equal(colors.tabBar, colors.surface);
    assert.equal(colors.headerBackground, colors.surface);
  }
});

test('10-A keeps existing theme switching and all layout measurements intact', () => {
  const context = read('src/contexts/ThemeContext.tsx');
  const layout = read('src/lib/designTokens.ts');
  assert.match(context, /const colors = isDark \? darkColors : lightColors/);
  assert.match(context, /themeMode === 'system'/);
  assert.match(context, /systemScheme === 'dark'/);
  assert.match(layout, /screenGutter: 16/);
  assert.match(layout, /controlMinHeight: 50/);
  assert.match(layout, /touchMinHeight: 48/);
});
