import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const workflow = source('.github/workflows/ui-screenshots.yml');
const installer = source('tools/ui/install_and_capture.sh');
const store = source('tools/ui/capture_store_sources.py');
const verify = source('tools/ui/verify_captures.py');

test('marketing source capture runs from an isolated test installation in Korean timezone', () => {
  assert.match(workflow, /-timezone Asia\/Seoul/);
  assert.match(installer, /python3 tools\/ui\/capture_android\.py/);
  assert.match(installer, /python3 tools\/ui\/capture_store_sources\.py/);
  assert.ok(installer.indexOf('capture_android.py') < installer.indexOf('capture_store_sources.py'));
  assert.match(store, /adb\("shell", "pm", "clear", APP\)/);
  assert.match(store, /EXPECTED_TIME_ZONE = "Asia\/Seoul"/);
  assert.match(store, /offset != "\+0900"/);
  assert.match(store, /SCREEN_WIDTH, SCREEN_HEIGHT = 1080, 1920/);
  assert.match(store, /SAMPLE_TITLES = \("Team meeting", "Design review", "Workout"\)/);
  assert.doesNotMatch(store, /UITest|TodayQA/);
});

test('seven original UI store sources are checked independently of 57 QA screens', () => {
  for (const name of [
    '01-home-briefing', '02-calendar-agenda', '03-entry-chooser',
    '04-save-confirmation', '05-schedule-detail', '06-settings', '07-dark-home',
  ]) {
    assert.ok(store.includes('capture("' + name + '.png"'), name + ' not captured');
    assert.ok(verify.includes('"' + name + '.png"'), name + ' not verified');
  }
  assert.match(verify, /store-source-manifest\.json/);
  assert.match(store, /"unaltered-device-capture"/);
  assert.match(store, /"not_captured"/);
  assert.match(store, /locate\(EXPECTED_TIME_ZONE\)/);
  assert.match(verify, /png_size\(path\) != \(1080, 1920\)/);
});
