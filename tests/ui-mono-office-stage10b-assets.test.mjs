import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const image = path => readFileSync(new URL('../' + path, import.meta.url));
const pngSize = path => {
  const data = image(path);
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', path);
  assert.equal(data.subarray(12, 16).toString('ascii'), 'IHDR', path);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};

test('10-B exports complete original-resolution PNG brand resources', () => {
  for (const p of [
    'assets/images/push-office-icon.png',
    'assets/images/push-office-icon-dark.png',
    'assets/images/push-office-adaptive-foreground.png',
    'assets/images/push-office-adaptive-monochrome.png',
    'assets/images/push-office-splash.png',
    'assets/images/push-office-splash-dark.png',
  ]) assert.deepEqual(pngSize(p), [1024, 1024], p);
  assert.deepEqual(pngSize('assets/images/push-office-mark.png'), [512, 512]);
  assert.deepEqual(pngSize('assets/images/push-office-store-icon.png'), [512, 512]);
  assert.deepEqual(pngSize('assets/images/push-office-favicon.png'), [64, 64]);
});

test('10-B has coherent five-screen illustration assets and themed native assets', () => {
  for (const name of ['home', 'calendar', 'settings', 'notifications', 'quick-entry']) {
    assert.deepEqual(pngSize(`assets/images/illustration-${name}-mono.png`), [448, 336], name);
  }
  const base = 'modules/push-office-native/android/src/main/res/';
  const light = base + 'drawable-nodpi/quick_entry_mono.png';
  const dark = base + 'drawable-night/quick_entry_mono.png';
  assert.deepEqual(pngSize(light), [560, 424]);
  assert.deepEqual(pngSize(dark), [560, 424]);
  assert.notDeepEqual(image(light), image(dark));
});

test('10-B adjusts only app icon/splash themes without changing package or release version', () => {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  assert.equal(config.android.package, 'com.hebi96.pushOffice_app');
  assert.equal(config.android.versionCode, 3);
  assert.equal(config.android.adaptiveIcon.backgroundColor, '#F7F8FA');
  const splash = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  assert.equal(splash.backgroundColor, '#F7F8FA');
  assert.equal(splash.dark.backgroundColor, '#111315');
  assert.equal(splash.dark.image, './assets/images/push-office-splash-dark.png');
  assert.deepEqual(pngSize('store-assets/ko-KR/app-icon-10b-candidate.png'), [512, 512]);
});
