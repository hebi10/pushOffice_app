# QA-12-08 — UI-12 최종 통합 병합·Android 29/35/36 검증

2026-11-12. GitHub: hebi10/pushOffice_app. 실제 앱 최종 `main` SHA: `4d532eb43a0d3d8d00755cf46019c3162b2d6db5`. QA PR #61은 이 최종 소스를 포함하도록 머지-베이스를 갱신함. QA PR은 앱 로직/서명/Play 릴리스 정책 변경 없음.

## UI-12-02~07 병합 상태 (최신 확인)

| PR | 주제 | HEAD | main Squash SHA | 독립 RN/Kotlin | 독립 API29 캡처 |
| --- | --- | --- | --- | --- | --- |
| #55 | 홈·브리핑 | d662a74c | 75d84bd8 | Success | 61 PNG / warning 0 |
| #56 | 캘린더 | 22e2dfc1 | 0a603952 | Success | 61 PNG / warning 0 |
| #57 | 네이티브 입력 3단계 | f389f03e | 5db4ffd7 | Success + API29 계측 Success | 61 PNG / warning 0 |
| #58 | 상세·수정 | 46e31084 | 0ef6fe3e | Success | 61 PNG / warning 0 |
| #59 | 기본·고급 설정 | 756b4f22 | 732366ff | Success | 61 PNG / warning 0 |
| #60 | AI 모델 관리 | 4b0ec642 | 4d532eb4 | Success | 61 PNG / warning 0 |

실제 6개 Android ZIP 원본에서 61개 PNG, manifest의 `warnings=[]`, `timezone=Asia/Seoul`, `utc_offset=+0900`, PNG 헤더 정상 및 주요 홈·달력·빠른 입력·상세·설정·AI 화면 누락 0개를 재확인. PR #57의 실패 원인 (과거 테스트의 고정 버튼 문자열과 다크 편집 화면 픽셀 위치)은 수정, 동일 HEAD RN/Kotlin/API29 native 계측/화면 캡처 모두 Success 확인 후 병합.

## 최종 통합 QA — 아직 이 문서만으로 PASS 아님

`main=4d532eb43a0d3d8d00755cf46019c3162b2d6db5` 전체 UI-12 변경을 포함한 QA 브랜치 HEAD에서 다음 GitHub Actions를 각각 성공 확인할 것.

1. Push Office UI validation — `npm test`, TypeScript, ESLint, Expo Android export, Kotlin compilation.
2. Push Office UI screenshots — Android API 29의 실제 앱 화면 61장·해시·warning 0·Asia/Seoul.
3. Push Office Mono Office native instrumentation — API29 위젯 2종/Quick Settings/네이티브 텍스트·음성·확인 흐름·실제 권한/삭제 회귀.
4. Push Office UI-12-08 Android 35/36 integration QA — API35와 API36 모두 위젯/타일/입력 계측, 설치된 debug 앱 smoke 및 실제 홈 PNG.
5. 소형 640x1360/태블릿 1440x2160, 다크·라이트, 130% 큰 글꼴, 일정 0·1·3건, 반복/종일/종료/삭제, 5종 AI 목록의 실제 기기 상태 및 민감 권한 승인 정책.

**실기기 미검증:** 삼성 One UI, ARM64 LiteRT-LM 4종 실모델 다운로드·해시·추론, AICore/Gemini Nano 지원 실기기, 160%/200% 글꼴의 기기별 완전 조작; CI 녹색만으로 실기기 PASS를 주장하지 않는다.

## Release 방지·배포 현황

사용자가 요청한 신규 `RELEASE-12-09` 전까지 기존 Google Play `1차 테스트` 버전 코드 19를 최종 배포 완료로 추정하지 않는다. 2026-11-12의 `main` 변경 시 원래 `android-release.yml`가 내부 테스트 release를 자동 시도했으며, 일부 실행은 Google Play API preflight HTTP 503으로 실패했다. 최종 릴리스는 Google Play API를 통해 기존 트랙 이름 `1차 테스트`의 정확한 `closed_track` 값을 재조회하고, 최신 versionCode/서명/AAB/commit 결과를 확인하는 별도 작업이다.

## 최종 판정 조건

QA PR #61 새 HEAD의 Android29/35/36 전체 검사·원본 artifact/manifest 검증이 성공하면 QA에 대해 PASS 가능; 그전에는 Draft·미병합 유지. 검증 완료 후 QA-only PR을 안전하게 병합하고 `main` 동일 소스 커밋으로 Release-12-09의 사전 점검을 진행한다. UI 외부 기능(로컬 백업·복원, daily/weekly 반복, 장소·메모, 선택 날짜를 네이티브 입력에 적용)은 아직 별도 기능 개발이 필요하다.
