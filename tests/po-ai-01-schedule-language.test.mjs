import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = 'modules/push-office-native/android/src/main/java/expo/modules/pushoffice/';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('PO-AI-01 shares production grammar, fails closed and retains explicit review', () => {
  const parser = read(root + 'ScheduleParser.kt');
  const policy = read(root + 'NotificationIntentPolicy.kt');
  const entry = read(root + 'QuickEntryActivity.kt');
  const runner = read(root + 'AiModelRunner.kt');
  const nano = read(root + 'NanoClient.kt');
  const time = read(root + 'AiScheduleTime.kt');
  assert.match(parser, /dates\.size > 1 \|\| times\.size > 1/);
  assert.match(parser, /ScheduleLanguage\.hasDate\(titlePart\)/);
  assert.match(parser, /ScheduleLanguage\.resolveTime\(time\)/);
  assert.match(policy, /ScheduleLanguage\.isChange\(combined\)/);
  assert.match(policy, /ScheduleParser\.parse\(source, now\)/);
  assert.match(entry, /basic\.error!=null \|\| basic\.start==null/);
  assert.match(entry, /parsed\.error != null && ScheduleLanguage\.isChange\(source\)/);
  assert.match(entry, /ScheduleRuntime\.save\(this,draft\)/);
  assert.match(runner, /ground\.error == null && ground\.start != null && ground\.shiftMinutes == null/);
  assert.match(nano, /ground\.error == null && ground\.start != null && ground\.shiftMinutes == null/);
  assert.match(time, /start\.toInstant\(\) == ground\.start\.toInstant\(\)/);
  assert.doesNotMatch(policy, /ScheduleRuntime\.save|ScheduleRuntime\.delete|AiModelRunner\.parse/);
});
