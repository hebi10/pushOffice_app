import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const listener = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleNotificationListener.kt');
const store = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NotificationSuggestionStore.kt');
const classifier = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NotificationIntentPolicy.kt');
const activity = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const settings = read('app/(tabs)/settings.tsx');
const ts = read('modules/push-office-native/index.ts');
const cases = read('modules/push-office-native/android/src/test/resources/noti-ai-01-triage-cases.tsv');

test('NOTI-AI-01 retains real notification listener, opt-in, no background AI and bounded records', () => {
  for (const symbol of ['NotificationSuggestionStore.enabled(this)', 'NotificationSuggestionStore.enabled(context)',
    'NotificationSuggestionStore.accessGranted(context)', 'NotificationIntentPolicy.classify(title, body, now)',
    'if (decision.triage == NotificationTriage.DISCARD) return@launch',
    'NotificationSuggestionStore.add(context, NotificationSuggestion(']) {
    assert.ok(listener.includes(symbol), symbol);
  }
  assert.doesNotMatch(listener, /NanoClient\.parse|AiModelRunner\.parse|http(s)?:\/\/|ScheduleRuntime\.save/);
  for (const symbol of ['private const val LIMIT = 24', 'private const val RETAIN_MS = 48L',
    'prefs(context).edit().clear().commit()', 'require(accessGranted(context))',
    'seen = (readSeen(context) + suggestion.id).takeLast(SEEN_LIMIT)']) {
    assert.ok(store.includes(symbol), symbol);
  }
});

test('NOTI-AI-01 exposes three-way decisions and never fills a missing date/time', () => {
  assert.match(classifier, /enum class NotificationTriage \{ CONFIRMED_CANDIDATE, NEEDS_CONFIRMATION, DISCARD \}/);
  assert.match(classifier, /NotificationSuggestionPolicy\.isSensitive\(title, body\)/);
  assert.match(classifier, /irrelevant\.containsMatchIn\(combined\)/);
  assert.match(classifier, /unambiguousTime\.containsMatchIn\(combined\)/);
  assert.match(classifier, /NotificationTriage\.NEEDS_CONFIRMATION/);
  assert.match(classifier, /startAt = null/);
  assert.match(store, /val startAt: Long\?/);
  assert.match(store, /val triage: String = "confirmed_candidate"/);
  assert.match(store, /if \(value\.has\("startAt"\) && !value\.isNull\("startAt"\)\)/);
  assert.match(store, /value\.optString\("triage", "confirmed_candidate"\)/);
  assert.match(store, /suggestion\.triage == "needs_confirmation" && start != null/);
  assert.match(store, /existing\.triage == "confirmed_candidate"/);
  assert.match(ts, /startAt: number \| null/);
  assert.match(ts, /triage: 'confirmed_candidate' \| 'needs_confirmation'/);
});

test('NOTI-AI-01 requires manual review for incomplete candidates and preserves safe schedule save', () => {
  assert.match(activity, /val date = suggestion\.startAt\?\.let/);
  assert.match(activity, /suggestion\.triage == "needs_confirmation"/);
  assert.match(activity, /"날짜·시간이 확정되지 않은 알림입니다/);
  assert.match(activity, /val dateField=field\("날짜 \(YYYY-MM-DD\)"/);
  assert.match(activity, /val timeField=field\("시간 \(HH:mm\)"/);
  assert.match(activity, /ScheduleTime\.validate\(draft,now\)/);
  assert.match(activity, /ScheduleSerial\.withLock/);
  assert.match(activity, /ScheduleRuntime\.save\(this,draft\)/);
  assert.match(activity, /if \(suggestionId != null\) NotificationSuggestionStore\.dismiss\(this, suggestionId\)/);
  assert.match(settings, /item\.triage === 'needs_confirmation' \|\| item\.startAt === null/);
  assert.match(settings, /'날짜·시간 확인 필요 · 임의의 시각을 저장하지 않습니다\.'/);
  assert.match(settings, /item\.triage === 'confirmed_candidate' && item\.startAt !== null && item\.analysis === 'local_rules'/);
  assert.match(settings, /item\.triage === 'needs_confirmation' \? '날짜·시간 확인' : '검토 후 저장'/);
  assert.match(settings, /label="거절 · 삭제"/);
  assert.doesNotMatch(settings, /new Date\(item\.startAt\s*\|\|\s*0\)/);
});

test('NOTI-AI-01 keeps all 60 synthetic benchmark cases and expected classifications', () => {
  const lines = cases.trimEnd().split('\n');
  assert.equal(lines.length, 61);
  assert.equal(lines[0],
    'id\tgroup\tapp\ttitle\tbody\texpected_local_start\texpected_repeat\texpected_triage');
  const data = lines.slice(1).map(s => s.split('\t'));
  assert.ok(data.every(d => d.length === 8));
  assert.equal(new Set(data.map(d => d[0])).size, 60);
  for (const [group, kind, count] of [
    ['complete', 'confirmed_candidate', 24], ['incomplete', 'needs_confirmation', 12],
    ['unrelated', 'discard', 14], ['sensitive', 'discard', 10],
  ]) {
    assert.equal(data.filter(d => d[1] === group && d[7] === kind).length, count);
  }
});
