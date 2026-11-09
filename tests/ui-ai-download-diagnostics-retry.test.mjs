import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const nano = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NanoClient.kt');
const diagnostics = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NanoDownloadDiagnostics.kt');
const screen = read('app/(tabs)/settings.tsx');
const types = read('modules/push-office-native/index.ts');
const bridge = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
const editor = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');

test('Gemini Nano download retains actual ML Kit failure code and never treats failure as success', () => {
  assert.match(nano, /DownloadStatus\.DownloadFailed/);
  assert.match(nano, /NanoDownloadDiagnostics\.from\(progress\.e\)/);
  assert.match(nano, /NanoDownloadDiagnostics\.from\(e\)\.asResult\(\)/);
  assert.match(nano, /NanoDownloadDiagnostics\.from\(e\)\.asResult\("기기 AI 상태 확인 오류"\)/);
  assert.match(nano, /"errorCode" to diagnostic\.code/);
  for (const code of ['AICORE_BINDING_601', 'AICORE_FEATURE_606', 'AICORE_NETWORK',
    'AICORE_FOREGROUND_REQUIRED', 'AICORE_DOWNLOAD_UNKNOWN', 'AICORE_NOT_READY']) {
    assert.ok(diagnostics.includes(code), code);
  }
  assert.doesNotMatch(diagnostics, /"message" to .*\.message/);
});

test('Gemini Nano retries are explicit and protected against concurrent requests', () => {
  assert.match(nano, /downloadMutex\.tryLock\(\)/);
  assert.match(nano, /downloadMutex\.unlock\(\)/);
  assert.match(nano, /FeatureStatus\.DOWNLOADABLE -> \{/);
  assert.match(nano, /client\.download\(\)\.collect/);
  assert.match(nano, /FeatureStatus\.DOWNLOADING/);
  assert.match(nano, /FeatureStatus\.UNAVAILABLE/);
  assert.match(bridge, /require\(appContext\.currentActivity\?\.hasWindowFocus\(\) == true\)/);
  assert.match(editor, /availability\["message"\] as\? String/);
  assert.doesNotMatch(nano.split('suspend fun status()')[1].split('suspend fun download(')[0], /client\.download\(\)/);
});

test('Settings exposes safe manual retry and refresh while preserving calendar actions', () => {
  assert.match(screen, /title=\{ai\.status === 'error' \? '기기 AI 다운로드 다시 시도'/);
  assert.match(screen, /title="기기 AI 상태 다시 확인"/);
  assert.match(screen, /ai\.status === 'error' && ai\.retryable/);
  assert.match(screen, /checkAiStatus/);
  assert.match(screen, /aiDownloadInFlight\.current/);
  assert.match(screen, /aiStatusSequence\.current/);
  assert.match(screen, /진단 코드: \{ai\.errorCode\}/);
  assert.match(types, /errorCode\?: string/);
  assert.match(types, /retryable\?: boolean/);
  for (const name of ['PushOfficeNative.openQuickEntry()', 'PushOfficeNative.getNotificationSuggestions()',
    'retryLegacyRecovery()', 'PushOfficeNative.requestAddTile()']) assert.ok(screen.includes(name), name);
});
