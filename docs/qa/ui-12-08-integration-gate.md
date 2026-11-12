# QA-12-08 — UI-12 전체 화면·기능 통합 QA 및 PR 안전 병합

프로젝트: `hebi10/pushOffice_app`. 시작 기준 `main=731a7abe7690d945e80ed575edb2f15d0b981619`, staging branch `qa/ui-12-08-integrated-main-20261112`.

명세: [UI-12-00 Google Drive 실제 화면 비교](https://docs.google.com/document/d/1HMLAr5KKDQ1peNKsfkCTyqFIfptxJG38K3h4B8ry9W8/edit) · [UI-12-01 최신 정합성 이미지](https://drive.google.com/drive/folders/1ON2Q7H13S1tr7o-mIHcbOyK4MD9pzmy9).

## 1. 선행 PR 순차 검사 게이트

| PR | 화면 | HEAD SHA | 검증 상태 | 머지 |
| --- | --- | --- | --- | --- |
| #55 | 홈·브리핑 | `d662a74c86b3ab9b6c3ca136d4b30da26d3425f8` | RN/Kotlin Success, API29 PNG 61장/warnings 0 | `main` squash `75d84bd8` |
| #56 | 캘린더·목록 | `22e2dfc1371d609c97be9fc1e673be06f5e7f6e6` | RN/Kotlin Success, API29 PNG 61장/warnings 0 | `main` squash `0a603952` |
| #57 | 빠른 입력 | `f389f03e5ff2d2f5b45940af0a16ec8a881ab5f9` | 구 QA 실패 2건 해결 커밋 반영; 새 QA 미확정 | 미병합 |
| #58 | 일정 상세 | `46e31084d969ed77a057c8d94cc28d5d9eee8181` | RN/Kotlin Success, API29 PNG 61장/warnings 0 | #57 후 병합 |
| #59 | 기본·고급 설정 | `756b4f229dbcaa392050a779a2cc38336c96fcc3` | RN/Kotlin Success, API29 캡처 진행 중 | #58 후 병합 |
| #60 | AI 모델 관리 | `4b0ec642ee5c0e1a63cfc97951ccbc25770ed244` | RN/Kotlin Success, API29 캡처 진행 중 | #59 후 병합 |

#57 구 실패의 원인과 실제 수정:
- Node 회귀 테스트 `tests/ui-quick-entry-redesign-stage3.test.mjs`가 3단계 고정 버튼 허용 목록의 옛 문자열을 검사함. 새 UI의 '뒤로/내용 확인'까지 테스트 계약에 반영.
- 어두운 테마 editor PNG `12-native-editor-dark`에서 고정 좌표 (100,500)이 실제 입력 필드(#292D31)로 이동. 보존되는 네이티브 상단 표면 픽셀 (100,300)의 RGB (28,31,34)를 이미지 원본에서 확인 후 화면 픽셀 검증 좌표를 이동. CSS/색상 토큰 자체를 임의 변경하거나 시각 QA를 생략하지 않음.

## 2. 독립 PR 검증 후 순차 병합

1. 각 PR HEAD SHA의 소스 변경/회귀 테스트/빌드 검증 상태를 확인. 성공 상태의 동일 SHA가 아니라면 병합 금지.
2. API29 캡처 ZIP 원본에 `capture-manifest.json`, PNG 61개, `warnings=[]`, `timezone=Asia/Seoul` / `utc_offset=+0900`, 누락·깨진 PNG 0개가 있는지 확인.
3. 기존 UI-12 작업 파일과 PR base가 충돌하지 않음을 GitHub가 판정해야 함.
4. PR을 Draft에서 Ready로 바꾼 다음 `expected_head_sha` 고정, squash로 다음 PR 순차 병합. 한 PR이 막히면 이후 PR 건너뛰어 병합하지 않음.
5. 서로 독립적인 PR의 브랜치 단독 CI 녹색은 최종 `main` 통합 PASS가 아님.

## 3. 완전 통합 Android QA

- `Push Office UI validation`: 최신 SHA npm test/TypeScript/ESLint/Expo Android bundle/Kotlin compile.
- `Push Office UI screenshots`: Android API29의 홈(0/1/3), 달력(0/1/3/선택 날짜 점프), 빠른 입력(텍스트/음성/확인/키보드/오류), 상세(시작/종료/종일/반복·삭제 모달), 설정(기본/고급, 실제 상태·저장 피드백), 기기 AI 모델(5종 실제 상태/리스트) 캡처를 원본·해시·매니페스트 확인.
- `Push Office Mono Office native instrumentation`: Android API29 widget small/agenda, Quick Settings tile, 네이티브 빠른 입력/권한 거부/확인 후 저장·알림, 실제 Kotlin 계측.
- `UI-12-08 Android API35/36 integration QA`: Android 35·36 각각 네이티브 widget/tile 계측, 설치된 debug 앱 실행, 실제 홈 PNG 유효성.
- 기기 폭 360dp·태블릿 1440px, 라이트/다크, 최소 130% 글꼴 캡처는 자동 증거에서 확인. **160·200% 및 삼성 One UI 물리기기·Gemini Nano AICore·ARM64 Qwen/Gemma 실제 추론은 별도 장비 증거가 없으면 미검증**.

## 4. 무결성 및 릴리스 범위

- 이전 로컬 SQLite 일정/반복 anchorZone, endAt, ID, 알림·재알림, 기기 AI 5종 카탈로그/고정 SHA-256, 직접 승인 전 개인정보 접근·저장 금지, 민감 알림 후보 보관 24건·48시간 고지·권한 철회·기본 OFF가 이전 동작과 동일해야 함.
- 실제 기획 7장 중 초기 시안에만 있는 매일/매주 반복, 장소·회의 URL·메모, 로컬 백업/복원, 외부 캘린더 양방향 연동은 **미구현 상태**이며 QA-12-08에서 추가하지 않음.
- 새로운 library/패키지/서명/Google Play 트랙 작업 금지. 기존 Play 1차 테스트 versionCode 19는 QA-12-08에서 그대로 유지.
- 누적 결과는 마지막 합친 `main` SHA의 Actions 링크와 증빙을 확인한 후에만 최종 PASS/FAIL 판정한다. 초기 staging 성공을 최종 완료로 기재하지 않는다.

## 5. 남은 작업

#57 최신 3개 Actions 통과 확인 → 안전 병합 → #58 검증 및 병합 → #59 완료 확인/병합 → #60 완료 확인/병합 → 최신 main 기반 QA 테스트 재실행 → Android 29/35/36 아티팩트 검증 → QA 요약을 Google Drive에 기록. 비공개 테스트 재배포는 별도 릴리스 승인이 필요하다.
