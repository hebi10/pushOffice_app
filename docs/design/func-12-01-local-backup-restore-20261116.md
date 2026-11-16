# FUNC-12-01 — 로컬 일정·설정 백업·복원

기준: 2026-11-16 · Push Office Android · Play/서명/Firebase 운영 변경 없음.

## 저장 위치와 사용자 흐름

- 고급 설정 → 로컬 백업과 복원 → **일정·설정 파일로 백업** → Android 저장 위치를 사용자가 직접 선택.
- **백업 파일 선택 및 복원** → Android 파일 선택 → JSON 스키마·버전·앱 패키지·SHA-256·타임존 검증 → 신규/중복 건수 미리보기 → 일정/설정 선택 후 복원.
- 복원 시 **일정 ID 충돌은 기존 데이터 우선**, 덮어쓰기 또는 기존 파일 삭제 없음.
- 설정 덮어쓰기는 기본 OFF. 사용자가 따로 설정 적용을 선택해야 알림·브리핑·테마·날씨/뉴스/주식 설정을 복원.
- 파일 선택을 취소하면 아무 데이터도 바꾸지 않음. 클라우드 전송, 자동 백업, 파일 선택 권한 상시 보관 없음.

## 파일 계약

- JSON UTF-8 / `format: pushoffice-local-backup` / `payload.version: 1` / `packageName: com.hebi96.pushOffice_app`.
- `sha256`은 canonical `JSON.stringify(payload)` 문자열에 대한 SHA-256 hex. 우연한 손상을 탐지하는 체크섬이며 **암호화·출처 인증·변조 방지 서명이 아님**.
- `payload`: 저장 시각(ISO), `NativeSchedule[]`(ID/원래 일정 시각/종료/종일/매월·매년 반복/알림 여부/문구/createdAt/updatedAt/anchorZone), `UserSettings`(알림/아침 브리핑/시간대/외부 정보 선택/테마/글꼴).
- 사용자 프로필·OAuth 토큰·Firebase 인증·채팅 내역·알림 원문 후보·기기 AI 모델 파일은 포함하지 않음. 파일 자체에 개인 일정 제목과 메모 성격의 sourceText가 포함될 수 있으므로 개인 보관 필수.
- 버전 불일치, 잘못된 필드/시간대, 중복 ID, SHA 불일치, 8MiB 초과를 파일 선택 후 즉시 거부. 복원 전 신규·중복 개수 표시.
- Android Storage Access Framework `ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`; 위험한 외부 저장소 읽기/쓰기 권한을 요청하지 않음.

## 실패·롤백 계약

- 일정 복원은 기존 `ScheduleStore`의 `ScheduleSerial` 잠금과 단일 SQLite 트랜잭션에서 실행. 전체 파일 검증을 먼저 마친 뒤 유효한 기록만 삽입하고 **다른 ID는 절대 삭제/덮어쓰기하지 않음**. 삽입 실패 시 DB 트랜잭션 롤백.
- 선택적 설정 복원은 현재 설정 스냅샷을 보관하고 설정부터 적용. 뒤따르는 일정 복원이 실패하면 `saveAssistantSettings(previousSettings)`로 원래 설정 복구를 시도. 설정 롤백마저 실패한 경우 그 사실을 명시하며 성공으로 보고하지 않음.
- DB 삽입 완료 후 Android 알림 재예약/위젯 갱신 결과를 따로 보고. 알림 재예약 실패는 데이터 롤백을 유발하지 않으며 사용자에게 재확인을 알림.
- 기기 내 파일 저장 도중 전원 차단/저장소 제공자 실패는 부분 파일을 남길 수 있으므로 저장 실패를 표시. 생성 중인 파일이 완전 백업이라고 가정하지 않음.

## 검증

1. `node --test tests/local-backup.test.mjs`: 실제 코덱 round-trip·한글·시간대·월간 반복·SHA·손상/타 앱/구버전·중복·크기·비밀정보 배제.
2. `LocalBackupDocumentsTest`: UTF-8·손상 바이트·입출력 8MiB 제한.
3. `LocalBackupRestoreTest`: 실제 Android SQLite 기존 ID 보존·중복 복원·불량 배치 롤백.
4. 기존 `ui-validation.yml`, `ui-native-instrumentation.yml`, `ui-12-08-android-matrix.yml`에서 Node/RN/Android Kotlin/API29·35·36 회귀.
5. **실물 파일 제공자/기기 재설치 QA**: 백업 저장 → Android 파일 앱에 파일 존재 확인 → 새 설치 또는 데이터 초기화 → 파일 선택 복원 → 화면·반복 알림·시간대·테마 확인. 이 항목은 물리 기기 또는 실제 문서 제공자에서 증빙 전에는 미검증.

## 배포 경계

이 PR은 기능/QA만 변경하며 GitHub 배포 워크플로의 OPS-01~08 승인·SHA 보호, 서명, 버전코드, Google Play 트랙, Firebase를 수정하지 않음. 신규 배포·승격은 별도 최종 QA/승인 뒤 실행.
