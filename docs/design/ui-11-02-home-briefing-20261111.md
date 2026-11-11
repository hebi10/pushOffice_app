# UI-11-02 — 홈·브리핑 정보 구조 개선

기준: 2026-11-11, `hebi10/pushOffice_app`
원본 계획: [Push Office UI-11 비교 기획서](https://docs.google.com/document/d/1pqyPFNEyQw2kT5EBCtZpUenwijLeOPBiW8G2RZEt-z4/edit)
Android 기준: [2026-11-11 실제 캡처 59장](https://github.com/hebi10/pushOffice_app/actions/runs/42952209462)
디자인 기준: Mono Office 10-A~10-F, 화이트/차콜·중성 회색, 기존 하단 3탭 유지.

## 문제와 구현

| 항목 | 기존 | UI-11-02 |
| --- | --- | --- |
| 홈 첫 화면 | 108dp 히어로 + 일정 추가 + 다음 일정 이후 큰 알림 권한 안내 | 홈 전용 `dense` 히어로(82dp), 주요 일정 콘텐츠를 먼저 표시 |
| 오늘 브리핑 | `첫 일정 <시각> · <제목>`이 다음 일정과 중복되고 건수 칩까지 병치 | 실제 `todayItems.length`로 짧은 건수 요약 한 번만 표시 |
| 오늘 일정 목록 | 알림 권한 카드·추천 후보가 앞에 위치 | 오늘 브리핑 직후 목록; 실제 전체 발생 일정을 그대로 표시 |
| 알림 분석 권한 | 긴 기본 설명과 별도 전체 폭 버튼 | 간결한 선택 기능/민감 알림 안내 및 48dp 설정 링크, 상세 개인정보 고지는 원래 `AppDialog` 유지 |
| 추천 일정 후보 | 최대 3개 승인/거절 액션 제공 | 위치만 오늘 일정 아래로 이동, 승인/거절/설정 이동·자동 저장 금지 보존 |
| 외부 브리핑 | 사용자 수동 요청만 API 사용 | 변경 없음 |

## 변경 파일

- `app/(tabs)/index.tsx`: 정보 블록 우선순위·중복 메시지·알림 안내·스타일.
- `src/components/ui/ScreenIntro.tsx`: 화면 단위 `dense` 스타일 옵션을 추가하며 기본 화면 크기는 그대로 둠.
- `tests/ui-11-02-home-briefing.test.mjs`: 순서·실제 데이터·AI·동의 절차·캡처 fixture 검사.
- 이전 버전에서 섹션 순서·브리핑 첫 일정 복제를 고정해 검사하던 테스트 2개는 11-02 새 승인 기준으로 갱신.

## 명시적 비변경

- `nextSchedule`·`projectOccurrences`·`ScheduleItem`·시간 범위·종일·반복·알림·상세 이동.
- 다른 앱 알림의 민감 정보 고지, Android 권한 설정, 후보 등록 전 승인·거절.
- `PushOfficeNative.generateBriefing`·`runForegroundRequest` 취소/가용성 판단.
- `useGenerateDigest` 및 외부 정보를 요청할 때만 가져오는 동작.
- React Native/Expo/Kotlin 스택, SQLite 로컬 저장, 하단 탭 3개, 앱 아이콘·스토어 이미지, Google Play 앱/트랙/버전.
- 할 일·집중 시간·회의 장소·상시 AI 채팅 등 신규 기능 추가 없음.

## QA 및 배포 게이트

1. PR 기준 커밋에서 `Push Office UI validation` Node/TypeScript/ESLint/Expo/Kotlin 모두 통과.
2. `Push Office UI screenshots`의 실제 Android 59장·warnings=0, 특히 `01-home`, `22a-home-today-one`, `22b-home-today-three`, `10-home-dark`, `20a-large-font-home`, `21a-tablet-home`를 확인.
3. 홈에서 0/1/3건·다크/130%·태블릿 화면의 행 높이, 긴 제목/스크롤/하단 탭·민감 권한 접근 링크 시인성을 검사.
4. 일정 승인 후보는 **자동 저장되지 않아야 하며**, 민감한 알림 권한 고지는 사용자 동작 전에 온전히 확인 가능해야 함.
5. 위 조건 확인 전 PR `main` 병합 금지. `main` 앱 소스 변경이 내부 테스트 자동 배포를 유발할 수 있으므로, 본 브랜치는 Play 배포를 실행하지 않음.

상태: 구현 PR과 CI 검증 작업으로 관리; Google Play 테스트 게시 성공 또는 물리 기기 QA 완료를 의미하지 않음.
