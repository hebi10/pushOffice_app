import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('PO-MAIN-CI-FINAL public privacy page and store text are exactly synchronized', () => {
  const publicPolicy = read('docs/privacy/index.html');
  const storeCopy = read('store-assets/privacy-policy-draft.ko.html');
  assert.equal(publicPolicy, storeCopy);
  assert.match(publicPolicy, /최종 수정일: 2026년 11월 16일/);
  assert.match(publicPolicy, /com\.hebi96\.pushOffice_app/);
  assert.match(publicPolicy, /asdlkj0104@gmail\.com/);
});

test('privacy discloses optional schedule details, lockscreen locations and no meeting URL in widgets', () => {
  const policy = read('docs/privacy/index.html');
  const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleRecord.kt');
  const extras = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleExtras.kt');
  const widget = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleWidgetProvider.kt');
  const briefing = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ReminderReceiver.kt');
  for (const label of ['장소', '회의 링크', '메모', '잠금 화면', '로컬 SQLite']) {
    assert.ok(policy.includes(label), 'privacy policy should disclose ' + label);
  }
  for (const field of ['location', 'meetingUrl', 'notes']) {
    assert.ok(native.includes('val ' + field + ': String?'), field);
  }
  assert.match(extras, /https/i);
  assert.match(widget, /event\.first\.location/);
  assert.match(briefing, /event\.location/);
  assert.doesNotMatch(briefing, /event\.notes|event\.meetingUrl/);
});

test('privacy explains user-selected unencrypted SAF export, not automatic cloud backup', () => {
  const policy = read('docs/privacy/index.html');
  const service = read('src/features/storage/localBackupService.ts');
  const nativeDocuments = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/LocalBackupDocuments.kt');
  assert.match(policy, /백업 파일/);
  assert.match(policy, /암호화되거나 서명된 파일은 아닙니다/);
  assert.match(policy, /자동 백업을 사용하지 않습니다/);
  assert.match(policy, /Google Drive/);
  assert.match(policy, /앱 삭제/);
  assert.match(service, /createLocalBackupDocument/);
  assert.match(service, /pickLocalBackupDocument/);
  assert.match(nativeDocuments, /contentResolver\.openOutputStream/);
});

test('data safety audit records old console answers as historical and requires live Play recheck', () => {
  const evidence = read('store-assets/data-safety-evidence.md');
  assert.match(evidence, /2026-11-16 최신 기능/);
  assert.match(evidence, /Console의 데이터 보안 양식 실시간 조회·저장 권한이 제공되지 않았으므로/);
  assert.match(evidence, /실제 UI 또는 인증된 API 결과를 확보하기 전에는/);
  assert.match(evidence, /기기 내 저장 자체는 Play의/);
  assert.match(evidence, /진단·기기 ID만 수집/);
});
