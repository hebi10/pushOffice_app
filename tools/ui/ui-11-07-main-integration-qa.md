# UI-11-07 — 병합본 Android 화면 통합 QA

기준 커밋: `d4d0e8d324a96f4cd8ad0c904ef187fb2571056e`.
구성: UI-11-04 PR #50, UI-11-05 PR #51, UI-11-06 PR #52 순차 병합본.
이 문서는 QA 실행 트리거 및 결과 추적용이며 앱 코드, 서명, Google Play 설정을 변경하지 않습니다.

## 자동 검증

- PR HEAD가 최종 `main` 병합본을 포함하는지 확인.
- `Push Office UI validation`: React Native/TypeScript/ESLint, Android Kotlin 빌드 및 단위 테스트.
- `Push Office UI screenshots`: Android API 29에서 실제 앱 화면/라이트·다크/소형·대형 글꼴/태블릿 뷰포트 및 0-warning, 매니페스트 검사.
- `Push Office Mono Office native instrumentation`: Android API 29 실제 위젯/빠른 설정 회귀 확인.

## 배포 보류 기준

Android API 35/36의 통합 Android UI 결과, 삼성 One UI 실기기 위젯·타일·알림·마이크, 실제 AI 모델 추론은 별도 검증이 필요합니다. 본 PR의 초록 CI만으로 Google Play 비공개 테스트 배포를 승인하지 않습니다.
