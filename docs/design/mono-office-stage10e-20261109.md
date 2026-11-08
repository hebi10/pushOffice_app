# Push Office Mono Office 10-E — 네이티브 UI·위젯·타일

기준일: 2026-11-09 (Asia/Seoul). 코드 대상: 기존 Draft PR #42.

## 구현
- Kotlin QuickEntryActivity의 파란색 중심 스타일을 10-A에서 정의한 라이트/다크 색상 역할에 맞춤. 앱에서 지정한 시스템/라이트/다크 테마 분기 유지.
- 네이티브 입력시트/브랜드 다이얼로그의 모서리 10dp, 버튼 8dp, 필드 6dp. 음성·AI 도구 확장 버튼에도 같은 중성 서피스와 테두리 적용.
- Android values, values-night에 네이티브 토큰 역할을 부여하고 각 디바이스 시스템 테마에 동기화. 앱 내 강제 테마는 명시적 PushOfficeDialogLight/Dark 색상으로 지원.
- 위젯 2종의 배경 10dp, 주요·보조 행동 8dp; 작은 브랜드명은 중성 보조 글자 색상. RemoteViews 데이터·크기·48dp 입력 버튼·PendingIntent는 변경 없음.
- 시스템 빠른 설정 타일의 아이콘을 단색 아웃라인 달력·체크로 보정. TileService와 Android 시스템 타일 추가 권한/잠금해제/클릭 동작은 불변.
- 앱 패키지, Kotlin 저장·반복·알림·음성·Gemini Nano·Firebase·외부 브리핑, 서명·버전코드·Play 트랙을 변경하지 않음.

## 검증
- tests/ui-mono-office-stage10e.test.mjs: Android native XML/RN 역할 대응, WCAG 대비, 위젯 48dp 버튼 및 클릭, 타일 스타일·동작 보존.
- 기존 테스트의 이전 아이콘 틴트 패턴과 위젯 버튼 라운드 기대값을 실제 새 스타일에 맞춰 갱신.
- CI 성공 전 단계 완료로 판단하지 않으며, 기존 물리기기 One UI 위젯·타일 배치/실제 AI/음성·권한 검증은 미완료로 분리.

## 다음
10-F 전체 Android UI 및 회귀 QA. 최종 출시 전 Draft 유지 및 main·Play 게시 보류.
