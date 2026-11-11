import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../app/ai-models.tsx', import.meta.url), 'utf8');

test('UI-11-05 displays state before expanded technical metadata', () => {
  for (const state of ['사용 준비됨','설치 가능','다운로드 중','무결성 검사 중','기기 미지원','오류 · 재시도 필요','설치 전']) {
    assert.ok(source.includes(state), state);
  }
  assert.match(source, /modelStatus\(model\)/);
  assert.match(source, /accessibilityLabel=\{'모델 상태: '/);
  assert.match(source, /expandedIds\.includes\(model\.id\)/);
  assert.match(source, /설명·라이선스 보기/);
  assert.match(source, /model\.license/);
});

test('UI-11-05 retains explicit download, integrity, test and successful selection gate', () => {
  for (const name of ['listAiModels','downloadAiModelById','verifyAiModel','testAiModel','selectAiModel','removeAiModel']) {
    assert.ok(source.includes('PushOfficeNative.' + name + '('), name);
  }
  assert.match(source, /!result\?\.success/);
  assert.match(source, /model\.selected && ready/);
  assert.match(source, /models\.filter\(isReady\)/);
  assert.match(source, /model\.state==='downloading'/);
  assert.match(source, /destructive title="기기 AI 모델 삭제"/);
  assert.match(source, /모델 테스트에서는 일정을 저장하지 않습니다/);
});

test('UI-11-05 keeps clear status, source and accessible details without adding a download dependency', () => {
  assert.match(source, /model\.sourceUrl/);
  assert.match(source, /accessibilityState=\{\{expanded:expandedIds\.includes\(model\.id\)\}\}/);
  assert.match(source, /minHeight:uiSizes\.touchMinHeight/);
  assert.doesNotMatch(source, /ScheduleRuntime\.save|ScheduleStore\(/);
});
