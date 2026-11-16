# FUNC-12-03 — 종료 시간 입력·매일/매주 반복 확장

기준일: 2026-11-16 / Push Office Android · React Native / 별도 Play 게시 없음

## 기능
- 네이티브 빠른 입력의 저장 전 확인 화면에 **종료 시간 (선택)** 그룹을 추가. 처음에는 접혀 있고, 사용자가 누르면 종료 날짜와 시간 필드를 열어 Android 날짜/시간 선택창 또는 직접 입력으로 지정.
- 종료 일자 미입력 시 시작 날짜를 사용. **종료 시간까지 비어 있으면 `endAt=null`** 로 저장. 종료 날짜만 입력하거나 종료가 시작보다 같거나 빠르면 저장 거부 및 수정 요청.
- 다음 날 종료처럼 자정을 넘는 일정은 날짜와 시간을 모두 명시해 저장.
- 기존 종료 시간이 있는 일정을 시각 이동으로 수정하면, 종료 필드를 별도로 바꾸지 않은 한 **기존 소요 시간 유지**.
- 반복 선택을 기존 반복 없음·매월·매년 3종에서 **반복 없음·매일·매주·매월·매년** 5종으로 확장. 세부 일정 수정 화면의 반복 옵션도 동일하게 제공.
- `매일 오후 3시 운동`은 다음 올바른 시각의 당일 또는 다음 날을 최초 앵커로 사용. `매주 금요일 오전 9시 회의`는 해당 요일의 다음 예정 시각을 앵커로 사용.
- `매주 오후 3시 점검`처럼 요일이 없는 입력은 캘린더 선택 날짜가 있어야 하며, 일반 홈 입력에서는 날짜 지정 안내. 시간 미기재 시 임의 시각을 지정하지 않음.
- React Native 캘린더·홈 다음 일정·상세 화면·행 레이블에 `daily`, `weekly` 반복과 `endAt` 시간 범위를 반영. 반복 계산은 최초 앵커 기준으로 수행해 계절별 시간 변경(DST)에도 현지 시각과 요일을 유지.
- Android `ReminderScheduler`, 두 홈 위젯, 아침 브리핑은 공용 `ScheduleTime.nextOccurrence`를 통해 일일·주간 예약/표시를 재계산. 기존 다음 알림 갱신, 권한, 안전 검사 유지.
- 모델 관리 표시 및 Gemini Nano·LiteRT-LM 프롬프트/검증에 신규 반복 유형 포함. 모델 출력의 날짜와 주기는 반드시 기기 결정론적 파서와 일치해야 함.
- 로컬 백업 v1 JSON에 새로운 두 반복 유형을 허용. SQLite 기존 `endAt INTEGER`·`repeatType TEXT` 열을 그대로 사용하므로 **스키마 버전 변경 불필요**, 기존 월간/연간 데이터 유지.

## 테스트 계약
1. Kotlin `ScheduleTimeTest`: daily/weekly 다음 발생 시각·현지시각·DST·끝 시간·기존 31일/윤일 앵커.
2. Kotlin `ScheduleParserTest` & `AiScheduleTimeTest`: 명시적 요일과 캘린더 선택일, 빠진 시각, AI 반복값 검증.
3. Android `QuickEntryActivityUiTest`: 종료 필드 접힘→열기, 기간이 잘못되면 저장 거부, 5종 반복 스피너, 임의 저장 금지.
4. Android `DailyWeeklyPersistenceTest`: 새 유형과 종료 시간을 기존 SQLite에 저장/재조회 후 정리. API29/35/36 네이티브 계측에서 실행.
5. Node `tests/func-12-03-recurrence-end-time.test.mjs`: React Native 다중 발생, 종료 시간, DST, 매월/매년 레거시 회귀.
6. Node `tests/local-backup.test.mjs`: 신규 반복 유형 포함한 백업 JSON 왕복 및 구형 invalid 유형 거부.
7. CI Node/TypeScript/ESLint/Expo/Kotlin → API29/35/36 + 실제 Android 캡처 61장/경고 0 → 배포 정책/보안 검사, 모두 동일 PR 커밋으로 확인.

## 제외 및 릴리스 경계
- 이번 단계는 선택형 종료 시각과 반복 주기이며, '종료 시간 자동 생성'이나 사용자 승인 없는 일정·알림 저장을 하지 않음.
- 기존 재설치·문서 제공자 백업 복원, 물리 One UI·실제 Gemini Nano/LiteRT-LM, 권한 철회 후 알림 동작은 별도 실기기 검증.
- Google Play internal/closed/production 배포, Firebase, 서명, 패키지 ID, 버전코드, OPS 승인 정책 변경 없음.
