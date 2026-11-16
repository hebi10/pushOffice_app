# FUNC-12-04 — 일정 장소·회의 링크·메모 데이터 확장

기준: 2026-11-16 · Push Office · Android/Kotlin + React Native · UI-12-00 기획 연동.

## 기능
1. **일정 생성/수정:** Android QuickEntryActivity의 기존 3단계 입력 흐름을 유지하고, 저장 전 확인 화면에 접을 수 있는 선택 필드(장소, HTTPS 회의 링크, 메모)를 추가. 선택 필드를 열기만 해서는 기록하지 않고, 기존 "일정 저장"/"변경 내용 저장"을 누른 경우에만 SQLite에 저장.
2. **일정 상세:** React Native 일정 관리에 장소(160자), 회의 링크(2048자), 메모(2000자) 편집 섹션. 값을 비우면 nullable로 저장. 기록에 있던 메모·링크·장소는 수정 전/후와 반복 일정 전체 수정 흐름에서 유지.
3. **링크 이동:** 사용자가 "저장된 회의 링크 열기"를 명시적으로 누른 경우에만 React Native Linking이 HTTPS 주소를 열어야 함. http/javascript/file, 무호스트 URL, 내장 user:pass, 공백·제어문자가 있는 URL은 저장/복원/열기에서 거부. 자동 URL 요청, 미리보기 네트워크 요청, 자동 AI·서버 전송 없음.
4. **일정 행·홈·위젯·일일 브리핑:** 실재 기록에 저장된 **장소만** 필요할 때 표시(없으면 UI 변화 없음). 회의 URL 및 자유 메모 전문은 홈/위젯/잠금화면 알림에 노출하지 않음. Android 위젯 기존 크기, 클릭, 라이트/다크, 160/200% 큰 글꼴 환경은 유지.
5. **데이터/마이그레이션:** SQLiteOpenHelper 버전 1→2에서 기존 `schedules`의 ID, 제목, 시간, 반복, 알림 상태, 저장 시각, `anchorZone`을 그대로 유지하면서 nullable `location TEXT`, `meetingUrl TEXT`, `notes TEXT` 3열만 `ALTER TABLE`로 추가. 새 설치는 v2 스키마 생성. 표준 트랜잭션 마이그레이션 실패 시 데이터 삭제/무조건 새 DB 재생성 금지.
6. **타입/백업:** `ScheduleRecord`, `ScheduleDoc`, `NativeSchedule`, `toNativeSchedule`/hydrate, Android `fromMap`/`toMap`, 기존 SQLite import·backup 복원을 모두 지원. 구형 JSON v1에는 새 필드가 없을 수 있으므로 checksum 검증 후 optional=null로 사용; 신규 JSON v1은 사용자가 입력한 새 필드를 포함하고 SHA-256 checksum으로 검증. 포맷 버전을 임의 변경하거나 레거시 복원 경로를 끊지 않음.

## 제한 및 개인정보
- 저장 내용에 민감 정보가 포함될 수 있으며 기존 사용자 선택 백업 파일은 **암호화되지 않음**. 저장·복원 안내에 이 사실을 유지.
- `notes`와 회의 URL은 데이터 계층과 상세 화면에 보존하지만 푸시 알림 제목, 일일 브리핑 본문, 위젯, AI 프롬프트, 외부 서버 요청에 추가하지 않음.
- 장소는 일일 브리핑 및 홈 위젯에서 노출될 수 있으므로 사용자가 기존 브리핑 기능을 명시적으로 켠 경우에만 일일 브리핑에 포함. 위젯은 이미 홈 화면에 배치된 경우만 갱신.
- Android 설정, 서명, Play 트랙·버전, 운영 Firebase, 알림 접근·AI 모델 자동 실행, 배포 인증에는 변경이 없음.

## 검증 기준
- Kotlin 단위: URL/문자열 유효성, nullable/기존 Map 호환, 정상/오류 입력 거부.
- Android 계측: 인메모리 SQLite v1 테이블/기존 행 → v2 마이그레이션(데이터와 nullable 열 확인), 실제 DB 새 필드 생성/재조회/수정/초기화 및 잘못된 URL에 의한 이전 데이터 보존.
- Android UI: QuickEntryActivity 선택 필드 펼침/저장 전 DB 불변/unsafe URL 실패/사용자 저장 후 재조회.
- Node: 선택 필드 정규화/악성 URL 거부; JSON v1 기존/신규 백업 왕복, 손상/타입 오류, 홈·위젯·브리핑 노출 범위.
- 동일 PR HEAD: Node test, TS, ESLint, Expo Android, Kotlin unit/debug 빌드, API29·35·36 계측·실제 앱 설치, 61 화면/경고 0, 스토어 이미지 8장 원본 검증, OPS-07/보안.
- 실제 사용자의 기존 SQLite 데이터가 설치 업그레이드 후 그대로 유지되는지, 실제 링크 앱 이동, 위젯 One UI/글꼴 확장, 앱 재설치 후 복원은 **별도 실제 기기 릴리스 QA**.

## 단계 완료 조건
기능 코드와 자동 회귀가 green인 경우에만 PR 승인/병합. Google Play 내부·비공개 테스트와 Firebase 운영 배포는 별도 단계로 분리.
