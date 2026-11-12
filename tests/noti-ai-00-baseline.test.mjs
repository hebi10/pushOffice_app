import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fixture = read('modules/push-office-native/android/src/test/resources/noti-ai-00-cases.tsv');
const kotlin = read('modules/push-office-native/android/src/test/java/expo/modules/pushoffice/NotiAi00BaselineTest.kt');
const listener = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleNotificationListener.kt');
const store = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NotificationSuggestionStore.kt');
const verifier = read('tools/qa/verify_noti_ai_00.py');

test('NOTI-AI-00 fixture is fixed, synthetic, balanced, and contains no real notification dump', () => {
  const lines = fixture.trimEnd().split('\n');
  assert.equal(lines.length, 61);
  assert.equal(lines[0], 'id\tgroup\tapp\ttitle\tbody\texpected_local_start\texpected_repeat');
  const samples = lines.slice(1).map(line => line.split('\t'));
  assert.ok(samples.every(c => c.length === 7));
  assert.equal(new Set(samples.map(c => c[0])).size, 60);
  for (const [group, n] of [['complete',24],['incomplete',12],['unrelated',14],['sensitive',10]]) {
    assert.equal(samples.filter(c => c[1] === group).length, n);
  }
  assert.ok(samples.filter(c => c[1] === 'complete').every(c => /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(c[5])));
  assert.ok(samples.filter(c => c[1] !== 'complete').every(c => c[5] === '-'));
  assert.ok(samples.some(c => c[4].includes('매월')));
  assert.ok(samples.some(c => c[4].includes('금요일')));
  assert.ok(samples.some(c => c[4].includes('회의 취소')));
  assert.ok(samples.some(c => c[4].includes('인증번호')));
  assert.doesNotMatch(fixture, /@[\w.-]+\.(com|kr)|https?:\/\/|010[- ]\d{4}[- ]\d{4}/);
});

test('NOTI-AI-00 measures production Kotlin gate and parser, not a copied JavaScript classifier', () => {
  assert.match(kotlin, /NotificationSuggestionPolicy\.candidate\(item\.title, item\.body\)/);
  assert.match(kotlin, /ScheduleParser\.parse\(it, clock\)/);
  assert.match(kotlin, /ZoneId\.of\("Asia\/Seoul"\)/);
  assert.match(kotlin, /assertEquals\(60, cases\.size\)/);
  assert.match(kotlin, /reportFile\.writeText\(report, Charsets\.UTF_8\)/);
  assert.match(kotlin, /assertTrue\("Sensitive synthetic alert passed the pre-AI gate\."/);
  assert.match(listener, /NotificationSuggestionPolicy\.candidate\(title, body\)/);
  assert.match(listener, /ScheduleParser\.parse\(source, now\)/);
});

test('NOTI-AI-00 keeps existing privacy, queue, opt-in and user approval guarantees unchanged', () => {
  for (const word of ['RETAIN_MS = 48L', 'private const val LIMIT = 24',
    'private const val ENABLED = "enabled"', 'prefs(context).edit().clear().commit()']) {
    assert.ok(store.includes(word), word);
  }
  assert.match(listener, /NotificationSuggestionStore\.enabled\(this\)/);
  assert.match(listener, /NotificationSuggestionStore\.accessGranted\(context\)/);
  assert.doesNotMatch(kotlin, /NotificationManager|NotificationListenerService|ScheduleStore\(/);
  assert.match(verifier, /fixtureSha256/);
  assert.match(verifier, /realNotificationMetrics/);
  assert.match(verifier, /sensitiveCandidateLeakIds/);
  assert.match(verifier, /finalConfusion/);
});
