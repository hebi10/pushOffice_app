import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const settings = read('app/(tabs)/settings.tsx');
const detail = read('app/schedule/[id].tsx');
const dialog = read('src/components/ui/AppDialog.tsx');

test('UI-11-04 keeps basic and advanced settings and meaningful status', () => {
  for (const phrase of ['기본 설정', '고급 설정', '알림과 아침 브리핑',
    '빠른 설정과 홈 위젯', '알림에서 일정 추천', '기기 내 음성과 AI',
    '알림 권한 확인 및 요청', '기기 AI 모델 관리', '추천 일정 후보']) {
    assert.ok(settings.includes(phrase), phrase);
  }
  assert.match(settings, /기기 내 알림 분석 · 기본값 꺼짐/);
  assert.match(settings, /5종 모델 설치·테스트·선택/);
  for (const phrase of ['saveAssistantSettings(patch)', 'PushOfficeNative.setNotificationCaptureEnabled(false)',
    'setNotificationDisclosure', 'PushOfficeNative.openNotificationAccessSettings()']) {
    assert.ok(settings.includes(phrase), phrase);
  }
});

test('UI-11-04 distinguishes editable details, repeat confirmation and destructive deletion', () => {
  for (const phrase of ['일정 제목 수정', '날짜와 시간', '반복과 알림', '변경 사항 저장',
    '재알림', '일정 삭제', '전체 반복 일정 삭제', '연결된 알림도 삭제되며 되돌릴 수 없습니다.']) {
    assert.ok(detail.includes(phrase), phrase);
  }
  for (const phrase of ['await update.mutateAsync', 'repeatType: repeat, notificationEnabled: notification',
    "pendingDialog === 'repeat'", "pendingDialog === 'delete'",
    'PushOfficeNative.snoozeSchedule(id, 10)', 'remove.mutateAsync(id)']) {
    assert.ok(detail.includes(phrase), phrase);
  }
});

test('UI-11-04 preserves cancellable and accessible modal actions', () => {
  for (const phrase of ['onRequestClose={onDismiss}', 'onPress={onDismiss}', 'onPress={onConfirm}',
    'minHeight: uiSizes.touchMinHeight', 'keyboardShouldPersistTaps="handled"',
    'accessibilityViewIsModal', 'accessibilityRole="header"', 'destructive ? colors.danger : colors.primary']) {
    assert.ok(dialog.includes(phrase), phrase);
  }
});
