import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const settings = read('app/(tabs)/settings.tsx');
const rows = read('src/components/settings/SettingsUI.tsx');
const capture = read('tools/ui/capture_android.py');
const verify = read('tools/ui/verify_captures.py');

test('UI-12-06 never presents unqueried quick-tile status as enabled or disabled', () => {
  assert.ok(settings.includes('const [tileEnabled, setTileEnabled] = useState<boolean | null>(null)'));
  assert.ok(settings.includes('PushOfficeNative.getQuickTileEnabled().then(setTileEnabled).catch(() => setTileEnabled(null))'));
  assert.ok(settings.includes("tileEnabled === null ? '사용 상태를 확인하고 있습니다.'"));
  assert.ok(settings.includes('value={tileEnabled === true}'));
  assert.ok(settings.includes('disabled={tileEnabled === null}'));
  assert.ok(settings.includes("status={tileEnabled === null ? '확인 중' : tileEnabled ? undefined : '꺼짐'}"));
  assert.ok(settings.includes('busy={tileEnabled === null}'));
  assert.ok(settings.includes('if (tileEnabled === true) void addTile()'));
  assert.ok(settings.includes('setTileEnabled(enabled)'));
});

test('UI-12-06 distinguishes a pending permission read from an actual denied permission', () => {
  assert.ok(settings.includes("status={notificationStatus === null ? '확인 중' : notificationStatus.accessGranted ? '허용됨' : '허용 필요'}"));
  assert.ok(settings.includes('PushOfficeNative.getNotificationSuggestionStatus().then(setNotificationStatus).catch(() => setNotificationStatus(null))'));
  assert.ok(settings.includes("setNotificationDisclosure('access')"));
  assert.ok(settings.includes('PushOfficeNative.openNotificationAccessSettings()'));
  assert.ok(settings.includes('PushOfficeNative.setNotificationCaptureEnabled(true)'));
  assert.ok(settings.includes('PushOfficeNative.setNotificationCaptureEnabled(false)'));
  assert.ok(settings.includes('onConfirm={confirmDisclosure}'));
});

test('UI-12-06 folds detailed privacy and power-limit notes without removing consent', () => {
  assert.ok(settings.includes('const [notificationHelpExpanded, setNotificationHelpExpanded] = useState(false)'));
  assert.ok(settings.includes('후보는 최대 24건·48시간 보관하며, 사용자가 승인한 일정만 저장합니다.'));
  assert.ok(settings.includes('title="알림 분석 방식·기기 제한 안내"'));
  assert.ok(settings.includes('expanded={notificationHelpExpanded}'));
  assert.ok(settings.includes('onPress={() => setNotificationHelpExpanded(value => !value)}'));
  assert.ok(settings.includes('{notificationHelpExpanded ? ('));
  assert.ok(settings.includes('모든 알림을 정확히 분석한다고 보장할 수는 없습니다.'));
  assert.ok(settings.includes('강제 종료·절전 제한·미지원 기기에서는 수집이나 AI 분석이 지연 또는 중단될 수 있습니다.'));
  assert.ok(settings.includes('인증번호·금융 알림처럼 민감한 내용도 권한 범위에 포함될 수 있습니다.'));
  assert.ok(settings.includes('기능을 끄면 후보 기록을 삭제하고'));
  assert.ok(settings.includes('reviewSuggestion(item.id)'));
  assert.ok(settings.includes('dismissSuggestion(item.id)'));
});

test('UI-12-06 shows real external service configuration without inventing data', () => {
  assert.ok(settings.includes("import { ENV } from '@/src/lib/env';"));
  assert.ok(settings.includes('const externalServiceConfigured = Boolean(ENV.FUNCTIONS_BASE_URL.trim())'));
  assert.ok(settings.includes('settings.digestTypes.weather, settings.digestTypes.news, settings.digestTypes.stocks'));
  assert.ok(settings.includes("externalServiceConfigured\n                  ? `요청할 때만 조회 · 선택 ${externalTypesSelected}종 · 일정 내용 전송 없음`"));
  assert.ok(settings.includes('외부 서비스 미연결 · 선택'));
  assert.ok(settings.includes('설정값만 저장'));
  for (const field of ['날씨', '뉴스', '주식', '외부 정보 상세 설정', '날씨 도시', '뉴스 키워드 (쉼표 구분)', '주식 종목 (쉼표 구분, 최대 5개)', '외부 정보 설정 저장']) {
    assert.ok(settings.includes(field), field);
  }
  assert.ok(settings.includes('stockTickers: tickers.split'));
  assert.ok(settings.includes('newsKeywords: keywords.split'));
});

test('UI-12-06 preserves original settings groups, private recovery and save feedback', () => {
  assert.ok(settings.includes("section === 'basic'"));
  assert.ok(settings.includes("accessibilityRole=\"tablist\""));
  for (const title of ['알림과 아침 브리핑', '빠른 설정과 홈 위젯', '알림에서 일정 추천',
    '기기 내 음성과 AI', '선택한 외부 정보', '이전 일정 가져오기', '화면과 보관', '개인정보와 지원']) {
    assert.ok(settings.includes(title), title);
  }
  for (const key of ['saveAssistantSettings(patch)', 'retryLegacyRecovery()', 'PushOfficeNative.requestPinWidget(kind)',
    'PushOfficeNative.downloadAiModel()', 'PushOfficeNative.openQuickEntry()', "themeMode: 'system'",
    '일정은 기기에 저장됩니다. 앱 삭제 시 로컬 일정도 삭제되며 Android 자동 백업은 사용하지 않습니다.']) {
    assert.ok(settings.includes(key), key);
  }
  assert.equal((settings.match(/accessibilityRole="alert"/g) || []).length, 2);
  assert.ok(rows.includes('minHeight: 56'));
  assert.ok(rows.includes('accessibilityValue={status ? { text: status } : undefined}'));
  for (const image of ['03-settings.png','03c-settings-time-expanded.png','03d-settings-save-notice.png',
    '04-settings-advanced.png','04a-settings-external-fields.png','03b-settings-basic-dark.png',
    '04b-settings-advanced-dark.png','20c-large-font-settings.png','21c-tablet-settings.png']) {
    assert.ok(capture.includes(image.replace('.png','')), 'Missing real capture scenario ' + image);
    assert.ok(verify.includes('"' + image + '"'), 'Missing capture manifest verifier entry ' + image);
  }
  assert.doesNotMatch(settings, /title="로컬 백업·복원"|"매일 반복"|"Google 캘린더 동기화"/);
});
