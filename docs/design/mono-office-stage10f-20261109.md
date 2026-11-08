# Push Office — Mono Office 10-F 전체 통합 QA

기준일: 2026-11-09 KST. 대상: PR #42 (통합 Draft).

## 자동 검증과 화면 매트릭스
1. GitHub UI validation: Node 전체 테스트, TypeScript, ESLint, Expo Android export, Kotlin 단위 테스트, Debug APK.
2. UI screenshots: Android API 29 Release APK 실제 에뮬레이터 설치, 57장 이상의 PNG, 누락 0 / 경고 0, 실제 기기 설정을 통한 라이트·다크 모드.
3. 신규 네이티브 픽셀 확인: Android 빠른 입력 선택·편집의 안전한 위치에서 차콜 RGB (28,31,34), 허용 오차 2를 검사합니다. 구형 RGB (30,41,59)는 불합격 처리합니다.
4. 기존 화면 매트릭스: 기본 홈·캘린더·설정·상세 및 네이티브 입력·반복·삭제, 작은 640x1360, 130% 글꼴, 태블릿 1440x2160, 실제 로컬 일정 0/1/3건, 보존 브리핑·채팅 기록, 다크 테마 및 두 위젯 제공자 등록.
5. 새 CI 작업: Android 에뮬레이터에서 기존 ScheduleWidgetViewsTest와 QuickEntryActivityUiTest를 실행하는 별도 instrumentation 워크플로. 위젯 0/1/2/3건·세로/가로·100/200% 글꼴·터치/클릭 Intent, 입력 선택·명시적 음성 시작을 검증하며 실제 런처와 혼동하지 않습니다.
6. 새 tests/ui-mono-office-stage10f.test.mjs로 네 단계 컴포넌트/화면·권한·저장·출시 보호 경로의 회귀 계약을 검사합니다.

## 판정 및 제한
- 각 워크플로의 최신 PR head SHA와 성공 판정을 대조합니다. 이전 커밋의 성공 또는 실행 중을 현재 완료로 기록하지 않습니다.
- 두 위젯의 실제 제조사 런처 배치·클릭, Android 13/14+ 타일 추가/잠금, 권한 철회, 실제 Gemini Nano 다운로드/음성 인식, Play 테스터 설치/업데이트는 물리 단말에서 별도 확인해야 합니다.
- Google Play 비공개 alpha 트랙은 과거 조회 기준 국가 목록이 0개였고 프로덕션과 동기화되어 있어 출시 전 해소가 필요합니다.
- 성공 검증 전 PR #42는 Draft; main 병합·자동 Play 내부/비공개 배포는 금지합니다.

## QA 증거 링크 (워크플로 완료 후 갱신)
- GitHub PR #42: https://github.com/hebi10/pushOffice_app/pull/42
- 이전 통과 SHA bbd7d8ae: UI validation #42491310540, UI screenshots #42491310575 (57장 / 경고 0).
- 본 새 커밋 CI 결과는 아직 미확정.

## 10-F 계측 실패 2건 교정
- 이전 계측 [#42496049161](https://github.com/hebi10/pushOffice_app/actions/runs/42496049161)은 위젯 200% 글꼴·160dp 높이에서 버튼과 하단 여백의 넘침 1건, 네이티브 chooser 최대 400dp 너비 초과 1건으로 실패했습니다. 실제 화면/측정 실패이며 테스트 기대값을 완화하지 않았습니다.
- 글꼴 150% 이상·높이 160dp 이하인 위젯에서는 정보 헤더를 숨기고 일정 행·48dp 입력 버튼을 우선합니다. 100% 글꼴의 일반 헤더 및 행 수, PendingIntent는 유지합니다.
- 네이티브 chooser/편집/선택 대화상자는 최대 400dp로 제한합니다. 작은 화면의 기존 가용 너비 제한과 클릭 흐름은 유지합니다.
- 최신 계측 테스트의 모든 조합 재검증이 완료되기 전 출시 게이트 미충족으로 기록합니다.
