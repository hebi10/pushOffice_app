import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { normalizeScheduleExtras, isSafeMeetingUrl } from '../src/features/schedules/scheduleExtras.ts';
import { createLocalBackup, parseLocalBackup } from '../src/features/storage/localBackupCodec.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const hash = async text => createHash('sha256').update(text, 'utf8').digest('hex');
const settings = {
  timezone: 'Asia/Seoul', pushEnabled: true, dailyBriefingEnabled: false,
  dailyBriefingTime: { hour: 8, minute: 0 },
  digestTypes: { weather: false, stocks: false, news: false }, digestCity: 'Seoul',
  weatherRegion: null, stockTickers: [], newsLanguage: 'ko', newsKeywords: [],
  newsCategories: [], themeMode: 'system', fontFamily: 'pretendard',
};
const record = {
  id: 'id-1', userId: 'local', type: 'schedule', title: '행사 준비',
  startAt: Date.parse('2026-11-25T14:00:00+09:00'),
  endAt: Date.parse('2026-11-25T15:00:00+09:00'),
  isAllDay: false, repeatType: 'weekly', notificationEnabled: true,
  notificationId: null, sourceText: '행사 준비', createdAt: 1, updatedAt: 1,
  anchorZone: 'Asia/Seoul',
};

test('FUNC-12-04 normalizes local-only optional values and rejects unsafe URL schemes', () => {
  assert.deepEqual(normalizeScheduleExtras({ location: ' 3층 회의실 ',
    meetingUrl: ' https://meet.example.org/room?meeting=12 ',
    notes: ' 준비물\n노트북 ' }),
  { location: '3층 회의실', meetingUrl: 'https://meet.example.org/room?meeting=12', notes: '준비물\n노트북' });
  assert.deepEqual(normalizeScheduleExtras({}), { location: null, meetingUrl: null, notes: null });
  for (const value of [
    'http://meet.example.org', 'javascript:alert(1)', 'file:///etc/passwd',
    'https://user:pass@meet.example.org/room', 'https://', 'https://meet.example.org/bad path',
  ]) {
    assert.equal(isSafeMeetingUrl(value), false, value);
    assert.throws(() => normalizeScheduleExtras({ meetingUrl: value }), /HTTPS/);
  }
  assert.equal(isSafeMeetingUrl('https://meet.example.org/room'), true);
  assert.throws(() => normalizeScheduleExtras({ location: 'X'.repeat(161) }), /장소/);
  assert.throws(() => normalizeScheduleExtras({ notes: 'Y'.repeat(2001) }), /메모/);
  assert.throws(() => normalizeScheduleExtras({ location: 'A\nB' }), /장소/);
});

test('v1 backup exports location/meeting URL/notes with recurrence and original anchor intact', async () => {
  const enriched = { ...record, location: '회의실 B',
    meetingUrl: 'https://meet.example.org/a', notes: '메모\n준비물' };
  const output = await createLocalBackup([enriched], settings, hash);
  const parsed = await parseLocalBackup(output, hash);
  assert.deepEqual(parsed.schedules, [enriched]);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.schedules[0].anchorZone, 'Asia/Seoul');
});

test('old valid v1 backups without optional fields remain readable and preserve checksum', async () => {
  const old = await createLocalBackup([record], settings, hash);
  const parsed = await parseLocalBackup(old, hash);
  assert.deepEqual(parsed.schedules, [record]);
  assert.ok(!Object.hasOwn(parsed.schedules[0], 'location'));
  assert.ok(!Object.hasOwn(parsed.schedules[0], 'notes'));
});

test('corrupted or malicious optional fields reject before restore', async () => {
  const wrongUrl = { ...record, meetingUrl: 'http://meet.example.org' };
  await assert.rejects(createLocalBackup([wrongUrl], settings, hash), /링크/);
  const wrongType = { ...record, notes: { admin: true } };
  await assert.rejects(createLocalBackup([wrongType], settings, hash), /메모/);
  const output = await createLocalBackup([{ ...record, location: '회의실' }], settings, hash);
  await assert.rejects(parseLocalBackup(output.replace('회의실', '악성 링크'), hash), /손상/);
});

test('both native JSON serialization and new schedule detail UI preserve the fields', () => {
  const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
  const store = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleStore.kt');
  const detail = read('app/schedule/[id].tsx');
  const quick = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
  const codec = read('src/features/schedules/scheduleCodec.ts');
  for (const key of ['location', 'meetingUrl', 'notes']) {
    assert.match(native, new RegExp('"' + key + '" to ' + key));
    assert.match(store, new RegExp('put\\("' + key + '"'));
    assert.match(codec, new RegExp(key + ': s\\.' + key));
    assert.ok(detail.includes('set' + key[0].toUpperCase() + key.slice(1)), key);
    assert.ok(quick.includes(key + '='));
  }
  assert.match(store, /"push_office_local\.db", null, 4/);
  assert.match(store, /if \(oldVersion < 2\)/);
  assert.match(store, /ALTER TABLE schedules ADD COLUMN location TEXT/);
  assert.match(store, /ALTER TABLE schedules ADD COLUMN meetingUrl TEXT/);
  assert.match(store, /ALTER TABLE schedules ADD COLUMN notes TEXT/);
  assert.match(detail, /저장된 회의 링크 열기/);
  assert.match(quick, /장소·링크·메모 입력/);
});

test('private notes and meeting links never appear in widget or lockscreen briefing text', () => {
  const widget = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleWidgetViews.kt');
  const scheduleWidget = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleWidgetProvider.kt');
  const briefing = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ReminderReceiver.kt');
  assert.match(scheduleWidget, /event\.first\.location/);
  assert.match(briefing, /event\.location/);
  assert.doesNotMatch(widget, /event\.notes|event\.meetingUrl/);
  assert.doesNotMatch(briefing, /event\.notes|event\.meetingUrl/);
});
