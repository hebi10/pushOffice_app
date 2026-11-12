import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeModelTest, downloadPercent } from '../src/features/ai/modelPresentation.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('app/ai-models.tsx');
const catalog = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiModelCatalog.kt');
const integrity = read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/AiModelDownloadStore.kt');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('UI-12-07 only reports download percentage when real total bytes are known', () => {
  assert.equal(downloadPercent(6, 12), 50);
  assert.equal(downloadPercent(0, 100), 0);
  assert.equal(downloadPercent(150, 100), 100);
  assert.equal(downloadPercent(-100, 100), 0);
  assert.equal(downloadPercent(1, 0), null);
  assert.equal(downloadPercent(1, -1), null);
  assert.equal(downloadPercent(1, Number.NaN), null);
  assert.equal(downloadPercent(Number.POSITIVE_INFINITY, 100), null);
  assert.equal(downloadPercent(1, Number.POSITIVE_INFINITY), null);
  assert.ok(page.includes("return percent === null ? '진행률 확인 중' : percent + '%'"));
  assert.doesNotMatch(page, /return 'Wi-Fi 대기'/);
  assert.match(page, /accessibilityRole="progressbar"/);
  assert.match(page, /accessibilityValue=\{\{min:0,max:100,now:progress\}\}/);
});

test('UI-12-07 shows measured outcomes, not zero-duration or Unix-epoch placeholders', () => {
  const success = describeModelTest({
    success: true,
    title: '치과 예약',
    startAt: Date.parse('2026-11-17T06:00:00Z'),
    repeatType: 'none',
    durationMs: 1299,
  });
  assert.match(success.headline, /1,299ms/);
  assert.match(success.details, /치과 예약/);
  assert.match(success.details, /2026/);
  assert.match(success.details, /반복 없음/);
  const incomplete = describeModelTest({success:true,title:'',durationMs:0});
  assert.equal(incomplete.headline, '테스트 결과');
  assert.match(incomplete.details, /제목 미확인/);
  assert.match(incomplete.details, /날짜·시간 미확인/);
  assert.match(incomplete.details, /반복 확인 필요/);
  assert.doesNotMatch(incomplete.details, /1970/);
  const failed = describeModelTest({success:false,durationMs:0,message:'모델 실행 실패'});
  assert.equal(failed.headline, '테스트 실패');
  assert.equal(failed.details, '모델 실행 실패');
  assert.doesNotMatch(failed.headline, /0ms/);
  assert.match(describeModelTest({success:true,durationMs:100,repeatType:'monthly'}).details,/매월 반복/);
  assert.match(describeModelTest({success:true,durationMs:100,repeatType:'yearly'}).details,/매년 반복/);
  assert.doesNotMatch(page, /new Date\(result\.startAt\|\|0\)/);
  assert.ok(page.includes('describeModelTest(result).details'));
});

test('UI-12-07 distinguishes loading, failed and confirmed native model list results', () => {
  assert.ok(page.includes("const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')"));
  assert.ok(page.includes("setListState('ready')"));
  assert.ok(page.includes("setListState('error')"));
  assert.ok(page.includes('title="기기 AI 모델 비교"'));
  assert.ok(page.includes('label="모델 목록 다시 확인"'));
  assert.ok(page.includes("listState !== 'ready'"));
  assert.ok(page.includes('모델 상태 조회 실패 · 이전 결과일 수 있음'));
  assert.ok(page.includes('사용 준비된 모델'));
  assert.ok(page.includes('모델 목록을 확인하고 있습니다.'));
  assert.ok(page.includes('const readyIds = new Set(next.filter(isReady).map(model => model.id))'));
});

test('UI-12-07 invalidates stale results after sample edits or model replacement', () => {
  assert.ok(page.includes('const sampleRevision = useRef(0)'));
  assert.ok(page.includes('sampleRevision.current += 1'));
  assert.ok(page.includes('setResults({});'));
  assert.ok(page.includes('if (revision === sampleRevision.current) setResults('));
  assert.ok(page.includes('if (revision !== sampleRevision.current) break;'));
  assert.ok(page.includes('delete next[id];'));
  assert.ok(page.includes('models.filter(isReady)'));
  assert.match(page, /!result\?\.success/);
  assert.ok(page.includes('PushOfficeNative.selectAiModel('));
  assert.ok(page.includes('PushOfficeNative.verifyAiModel('));
  assert.ok(page.includes('PushOfficeNative.downloadAiModelById('));
  assert.ok(page.includes('PushOfficeNative.testAiModel('));
  assert.ok(page.includes('PushOfficeNative.removeAiModel('));
});

test('UI-12-07 preserves all five approved catalog names and integrity restrictions', () => {
  for (const name of ['Gemini Nano','Qwen3 0.6B','Qwen3.5 0.8B','Qwen3.5 2B','Gemma 4 E2B']) {
    assert.ok(catalog.includes('"' + name + '"'), name);
  }
  assert.ok(integrity.includes('AiModelIntegrity.matches('));
  assert.ok(integrity.includes('model.sha256 == null || model.sha256 == rawHash'));
  assert.ok(integrity.includes('return if (verifiedInstalledFile(ctx, model) != null)'));
  assert.ok(page.includes('모델 테스트에서는 일정을 저장하지 않습니다.'));
  assert.ok(page.includes("model.id !== 'gemini-nano'"));
  assert.ok(page.includes("model.id!=='gemini-nano'"));
  assert.ok(page.includes('model.selected && ready'));
  assert.ok(page.includes('기본 선택됨'));
  assert.ok(page.includes('실제 추출 결과·응답 시간만 표시합니다.'));
  assert.doesNotMatch(page, /Llama 3\.2|정확도:?\s*\d|개인정보 전송/);
  for (const screenshot of ['19a-ai-model-manager','19b-ai-model-manager-lower']) {
    assert.ok(capture.includes('"' + screenshot + '"'), screenshot);
    assert.ok(verify.includes('"' + screenshot + '.png"'), screenshot);
  }
});
