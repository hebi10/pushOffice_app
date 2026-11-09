import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const model = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiModelCatalog.kt');
const manager = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiModelDownloadStore.kt');
const runner = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiModelRunner.kt');
const native = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/PushOfficeNativeModule.kt');
const editor = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt');
const types = read('modules/push-office-native/index.ts');
const screen = read('app/ai-models.tsx');
const settings = read('app/(tabs)/settings.tsx');
const navigation = read('app/_layout.tsx');
const gradle = read('modules/push-office-native/android/build.gradle');

test('five genuine public models have safe source links and a fixed LiteRT runtime version', () => {
  for (const id of ['gemini-nano','qwen3-06','qwen35-08','qwen35-2','gemma4-e2b'])
    assert.ok(model.includes('AiModelDefinition("' + id + '"'), id);
  assert.match(model, /https:\/\/huggingface\.co\//);
  assert.doesNotMatch(model, /api[_-]?key|Bearer /i);
  assert.match(gradle, /com\.google\.ai\.edge\.litertlm:litertlm-android:0\.19\.1/);
  assert.match(model, /get\(id: String\): AiModelDefinition/);
});

test('model downloads are explicit, verified and app-owned, with delete and recovery', () => {
  for (const phrase of [
    'setAllowedOverMetered(false)', 'setDestinationInExternalFilesDir',
    'X-Linked-Etag', 'X-Linked-Size', 'MessageDigest.getInstance("SHA-256")',
    'expectedSize(ctx, model.id)', 'remote.sha',
    'StatFs(folder.path).availableBytes', 'synchronized(lock)',
    'expectedSha(ctx, model.id)', 'downloadId(ctx, id)',
    'DownloadManager.STATUS_SUCCESSFUL', 'DownloadManager.STATUS_FAILED',
    'setNotificationVisibility', 'getExternalFilesDir(null)',
    'prefs(ctx).edit().putString(SELECTED,id).commit()',
  ]) assert.ok(manager.includes(phrase), phrase);
  assert.match(manager, /fun installedFile\(ctx: Context, model: AiModelDefinition\)/);
  assert.match(manager, /suspend fun remove\(ctx: Context, id: String\)/);
  assert.doesNotMatch(manager, /https?:\/\/[^"]*\.apk|Downloads\/public/);
});

test('selected model is used for all existing local AI interactions, not just the management screen', () => {
  for (const name of ['listAiModels','downloadAiModelById','removeAiModel','selectAiModel','testAiModel']) {
    assert.ok(native.includes('AsyncFunction("' + name + '")'), name);
    assert.ok(types.includes(name + '('), name);
  }
  assert.match(native, /AiModelRunner\.parse\(context,AiModelDownloadStore\.selected\(context\)/);
  assert.match(native, /AiModelRunner\.briefing\(context,AiModelDownloadStore\.selected\(context\)/);
  assert.match(editor, /AiModelRunner\.parse\(/);
  assert.match(editor, /AiModelDownloadStore\.selected\(this@QuickEntryActivity\)/);
  assert.match(runner, /Engine\(EngineConfig\(modelPath = file\.absolutePath, backend = Backend\.CPU\(\)\)\)/);
  assert.match(runner, /ScheduleTime\.validate\(candidate/);
  assert.doesNotMatch(runner, /ScheduleRuntime\.save|ScheduleStore\(context\)\.save/);
});

test('new accessible model management screen lists, downloads, compares, selects and deletes', () => {
  assert.match(settings, /title="기기 AI 모델 관리"/);
  assert.match(settings, /router\.push\('\/ai-models'\)/);
  assert.match(navigation, /Stack\.Screen name="ai-models"/);
  assert.match(screen, /PushOfficeNative\.listAiModels\(\)/);
  for (const action of ['downloadAiModelById','selectAiModel','removeAiModel','testAiModel'])
    assert.ok(screen.includes('PushOfficeNative.' + action + '('), action);
  assert.match(screen, /'compare'/);
  assert.match(screen, /!result\?\.success/);
  assert.match(screen, /model\.sourceUrl/);
  assert.match(screen, /model\.state==='downloading'/);
  assert.match(screen, /destructive title="기기 AI 모델 삭제"/);
});

test('local inference never creates schedules or falls back silently to cloud', () => {
  assert.match(runner, /inferenceMutex\.withLock/);
  assert.match(runner, /Engine\(EngineConfig/);
  assert.match(runner, /createConversation\(\)\.use/);
  assert.match(runner, /conversation\.sendMessage\(prompt\)\.toString\(\)/);
  assert.match(runner, /if \(id == "gemini-nano"\) return NanoClient\.parse/);
  assert.match(runner, /if \(id == "gemini-nano"\) return NanoClient\.briefing/);
  assert.doesNotMatch(runner, /fetch\(|axios|\.firebase|URL\(/);
});
