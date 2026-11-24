import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { describeInferenceMetrics } from '../src/features/ai/modelPresentation.ts';

const root = 'modules/push-office-native/android/src/main/java/expo/modules/pushoffice/';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('PO-AI-02 only renders measured phase timings and system RAM snapshots', () => {
  assert.deepEqual(describeInferenceMetrics({success:true,durationMs:100}), []);
  const lines = describeInferenceMetrics({success:true,durationMs:500,verifyMs:123,initializeMs:200,generationMs:95,
    availableRamBeforeMb:4321,availableRamAfterMb:3900});
  assert.equal(lines.length,4);
  assert.match(lines[0],/123ms/);
  assert.match(lines[1],/200ms/);
  assert.match(lines[2],/95ms/);
  assert.match(lines[3],/4,321 → 3,900MB/);
  assert.match(lines[3],/최대 사용량 아님/);
  assert.deepEqual(describeInferenceMetrics({success:false,durationMs:0,verifyMs:-1,initializeMs:NaN,generationMs:Infinity}),[]);
});

test('PO-AI-02 list cache cannot authorize inference or model selection; file lease is serialized',()=>{
  const store=read(root+'AiModelDownloadStore.kt');
  const runner=read(root+'AiModelRunner.kt');
  const nano=read(root+'NanoClient.kt');
  assert.match(store,/if \(listOnly && statusCache\.fresh/);
  assert.match(store,/verifyLocked\(ctx, model, listOnly = true\)/);
  assert.match(store,/withVerifiedInstalledFile[\s\S]*?operations\.withLock[\s\S]*?val file = verifyLocked\(ctx, model\)/);
  assert.match(store,/choose\([\s\S]*?require\(verifyLocked\(ctx, model\) != null\)/);
  assert.match(store,/AiModelIntegrity\.matches\(file, size, sha\)/);
  assert.match(runner,/inferenceMutex\.withLock[\s\S]*?before\.memoryReady\(model\)[\s\S]*?withVerifiedInstalledFile\(context, model\)/);
  assert.match(runner,/catch \(error: CancellationException\) \{ throw error \}/);
  assert.match(nano,/AiInferenceGate\.mutex\.withLock/);
  assert.match(store,/recoverJob\(ctx, AiModelCatalog\.get\(id\)\)/);
  assert.match(store,/enoughStorage\(StatFs\(folder\.path\)\.availableBytes, remote\.size, outstanding\)/);
  assert.match(store,/setAllowedNetworkTypes\(DownloadManager\.Request\.NETWORK_WIFI\)/);
  assert.match(store,/putLong\(id \+ "_download",next\)\.commit\(\)/);
});

test('PO-AI-02 screen pauses polling when hidden or busy and does not auto-select',()=>{
  const ui=read('app/ai-models.tsx');
  assert.match(ui,/if \(!focused \|\| !foreground \|\| busyId \|\| !downloading\) return/);
  assert.match(ui,/refreshRequested\.current/);
  assert.match(ui,/현재 기기 기준 추천/);
  assert.match(ui,/!result\?\.success\|\|!hasRuntimeMemory\(model\)/);
  assert.match(ui,/if \(revision !== sampleRevision\.current\) break/);
  assert.match(ui,/describeInferenceMetrics\(result\)/);
  assert.doesNotMatch(ui,/if \(model\.recommended\)[^\n]*selectAiModel/);
});
