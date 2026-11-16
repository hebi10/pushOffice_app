import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createLocalBackup, parseLocalBackup, MAX_LOCAL_BACKUP_LENGTH } from '../src/features/storage/localBackupCodec.mjs';
import { readFileSync } from 'node:fs';

const sha256 = async value => createHash('sha256').update(value, 'utf8').digest('hex');
const now = new Date('2026-11-16T05:30:00.000Z');
const settings = {
  timezone: 'Asia/Seoul',
  pushEnabled: true,
  dailyBriefingEnabled: true,
  dailyBriefingTime: { hour: 8, minute: 30 },
  digestTypes: { weather: false, stocks: false, news: false },
  digestCity: 'Seoul',
  weatherRegion: { sido: '서울특별시', gugun: '중구' },
  stockTickers: ['005930'],
  newsLanguage: 'ko',
  newsKeywords: ['출근'],
  newsCategories: ['technology'],
  themeMode: 'dark',
  fontFamily: 'pretendard',
};

const appointment = {
  id: 'backup-test-001',
  userId: 'local',
  type: 'event',
  title: '11월 진료 예약',
  startAt: Date.parse('2026-11-20T09:30:00.000Z'),
  endAt: Date.parse('2026-11-20T10:00:00.000Z'),
  isAllDay: false,
  repeatType: 'monthly',
  notificationEnabled: true,
  notificationId: null,
  sourceText: '11월 20일 오후 6시 30분 진료 예약',
  createdAt: now.getTime(),
  updatedAt: now.getTime(),
  anchorZone: 'Asia/Seoul',
};

const digest = async doc => sha256(JSON.stringify(doc));

test('FUNC-12-01 versioned UTF-8 JSON round trip keeps Korean titles, recurrence, zones and settings', async () => {
  const output = await createLocalBackup([appointment], settings, sha256, now);
  const archive = await parseLocalBackup(output, sha256);
  assert.equal(archive.version, 1);
  assert.equal(archive.packageName, 'com.hebi96.pushOffice_app');
  assert.equal(archive.exportedAt, now.toISOString());
  assert.deepEqual(archive.schedules, [appointment]);
  assert.deepEqual(archive.settings, settings);
  assert.match(output, /11월 진료 예약/);
  assert.ok(!output.includes('password'));
  assert.ok(!output.includes('firebaseAuth'));
});

test('damaged file is rejected before any restore', async () => {
  const output = await createLocalBackup([appointment], settings, sha256, now);
  await assert.rejects(parseLocalBackup(output.replace('진료 예약', '회의 예약'), sha256), /손상/);
  await assert.rejects(parseLocalBackup(output.slice(0, -15), sha256), /JSON/);
});

test('foreign app, unsupported version and mismatched checksums are rejected', async () => {
  const original = JSON.parse(await createLocalBackup([appointment], settings, sha256, now));
  const foreign = structuredClone(original);
  foreign.payload.packageName = 'com.other.app';
  foreign.sha256 = await digest(foreign.payload);
  await assert.rejects(parseLocalBackup(JSON.stringify(foreign), sha256), /파일 형식이나 버전/);

  const newer = structuredClone(original);
  newer.payload.version = 2;
  newer.sha256 = await digest(newer.payload);
  await assert.rejects(parseLocalBackup(JSON.stringify(newer), sha256), /파일 형식이나 버전/);

  const invalid = structuredClone(original);
  invalid.sha256 = 'a'.repeat(64);
  await assert.rejects(parseLocalBackup(JSON.stringify(invalid), sha256), /손상/);
});

test('daily/weekly reminders and selected end times round-trip without changing IDs or local zones', async () => {
  const daily = { ...appointment, id: 'daily-anchor', repeatType: 'daily', endAt: appointment.startAt + 5400000 };
  const weekly = { ...appointment, id: 'weekly-anchor', repeatType: 'weekly', endAt: null };
  const output = await createLocalBackup([daily, weekly], settings, sha256, now);
  const restored = await parseLocalBackup(output, sha256);
  assert.deepEqual(restored.schedules, [daily, weekly]);
});

test('duplicate IDs and invalid schedules never proceed to restore', async () => {
  await assert.rejects(
    createLocalBackup([appointment, { ...appointment, title: '중복' }], settings, sha256, now),
    /중복/,
  );
  await assert.rejects(
    createLocalBackup([{ ...appointment, startAt: Number.NaN }], settings, sha256, now),
    /일정 데이터/,
  );
  await assert.rejects(
    createLocalBackup([{ ...appointment, repeatType: 'hourly' }], settings, sha256, now),
    /일정 데이터/,
  );
  await assert.rejects(
    createLocalBackup([{ ...appointment, endAt: appointment.startAt - 1 }], settings, sha256, now),
    /일정 데이터/,
  );
});

test('invalid settings, unknown timezone and unsupported large files are rejected', async () => {
  await assert.rejects(
    createLocalBackup([], { ...settings, timezone: 'Not/A_Zone' }, sha256, now),
    /시간대/,
  );
  await assert.rejects(
    createLocalBackup([], { ...settings, dailyBriefingTime: { hour: 25, minute: 1 } }, sha256, now),
    /알림 설정/,
  );
  await assert.rejects(parseLocalBackup('x'.repeat(MAX_LOCAL_BACKUP_LENGTH + 1), sha256), /너무 크/);
});

test('backup excludes undeclared secrets and arbitrary nested metadata', async () => {
  const output = await createLocalBackup(
    [{ ...appointment, privateCredential: 'dont-export' }],
    { ...settings, authToken: 'dont-export', firebasePassword: 'dont-export' },
    sha256, now,
  );
  assert.doesNotMatch(output, /dont-export|authToken|privateCredential|firebasePassword/);
});

test('native restore uses SQLite transaction, preserves existing IDs and avoids broad storage permissions', () => {
  const root = new URL('../', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const store = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleStore.kt');
  const module = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
  const documents = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/LocalBackupDocuments.kt');
  const ui = read('app/(tabs)/settings.tsx');
  assert.match(store, /fun importBackupRecords/);
  assert.match(store, /db\.beginTransaction\(\)/);
  assert.match(store, /if \(get\(record\.id\) == null\)/);
  assert.match(module, /AsyncFunction\("importBackupSchedules"\)/);
  assert.match(module, /Intent\.ACTION_CREATE_DOCUMENT/);
  assert.match(module, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(documents, /MAX_BYTES/);
  assert.match(ui, /title="로컬 백업과 복원"/);
  assert.match(ui, /title="설정 적용"/);
  assert.doesNotMatch(module, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/);
});
