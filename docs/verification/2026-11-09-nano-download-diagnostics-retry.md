# Push Office · Gemini Nano 모델 다운로드 오류 진단·재시도

작업일: 2026-11-09 / 기존 1차 테스트 릴리스 1.1.0 (17) 이후 보완 사항. 실기기 다운로드 성공이 확인되기 전에는 오류 완전 해결로 판단하지 않습니다.

## 기능
- ML Kit `DownloadStatus.DownloadFailed.e`의 오류 범주를 분석하고 사용자에게 안전한 진단 코드 및 조치 안내 표시.
- `Generation.getClient()`, `checkStatus()` 자체의 오류도 일관된 진단 결과로 반환.
- `DOWNLOADABLE` 및 재시도 가능 오류 상태에서 사용자가 직접 다운로드를 재요청할 수 있도록 설정 화면 개선.
- `DOWNLOADING` 상태에서는 중복 다운로드하지 않고 상태 새로고침으로 진행 여부 확인.
- 코루틴 취소 전파, 다운로드용 모델 클라이언트 종료, `Mutex.tryLock` 중복 실행 차단, 화면 포커스 검증 유지.
- 원시 오류 메시지·서버 주소·개인정보를 UI에 표시하거나 로컬 저장하지 않음. 안정적인 코드만 표시.
- 모델 파일은 Android AICore 소유. 사용자 동의 없는 자동 재시도·초기화·재설치·클라우드 AI 대체 호출 없음.

## 오류 대응
| 코드 | 사용자 안내 |
|---|---|
| `AICORE_BINDING_601` | AICore 업데이트, 앱 다시 실행 |
| `AICORE_FEATURE_606` | 기기 네트워크 연결·AICore 구성 업데이트·재시작 후 상태 확인 |
| `AICORE_NETWORK` | Wi-Fi/네트워크 상태 확인 후 사용자가 직접 재시도 |
| `AICORE_FOREGROUND_REQUIRED` | 앱 화면 활성 상태에서 재요청 |
| `AICORE_DOWNLOAD_UNKNOWN` | AICore·Android 업데이트 후 상태 확인 |
| `AICORE_NOT_READY` | 상태 확인 후 재시도 |

## 회귀 검사
- Kotlin JUnit `NanoDownloadDiagnosticsTest.kt` (분류 4종, 민감 정보 비노출, 설치 미확정 처리).
- Node `ui-ai-download-diagnostics-retry.test.mjs` (SDK 오류 이벤트·중복 요청·수동 UI·기존 기능 보존).
- GitHub PR CI: Node 전체 테스트, TypeScript, ESLint, Expo Android 번들, Kotlin 테스트/Debug 빌드.
- AI 모델 다운로드 성공과 `available` 상태 전환, 실제 AI 추론은 Gemini Nano 지원 물리 기기에서 검증 필요.
- Google Play 트랙, 서명, 릴리스 버전코드, 위젯·타일·알림 메시지 수집·저장 데이터 변경 없음.

참고: https://developers.google.com/ml-kit/genai/prompt/android/get-started
