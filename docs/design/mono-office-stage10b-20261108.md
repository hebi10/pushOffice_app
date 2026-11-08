# Push Office — Mono Office 10-B (1차): 홈 일러스트 경량화

기준: 2026-11-08 / 브랜치 `feature/pushoffice-mono-office-10a-colors-20261108`

## 검증 완료된 선행 작업 — 10-A
- 기준 SHA: `14f21af1f3f6f654f886734fc3d7b5b5b5e0a042`.
- React Native, TypeScript, ESLint, Expo Android export, Kotlin 단위/Debug APK: [Actions #42482487806](https://github.com/hebi10/pushOffice_app/actions/runs/42482487806) 성공.
- Android 에뮬레이터 UI 57장, 필수 화면 누락 0건, UI 검증 경고 0건: [Actions #42482487800](https://github.com/hebi10/pushOffice_app/actions/runs/42482487800).
- 캡처 아티팩트 ID `13619190075`, SHA256 `f5ff9168c57c313f86fb96a90bcf8329e7e4a5fdc617eba6d7a711992423d606`.
- 실제 물리 단말에서의 위젯 클릭·Gemini Nano 모델·권한은 검증 완료로 기록하지 않습니다.

## 10-B 1차 적용 범위
- 홈 `ScreenIntro`의 JPG 일러스트 1개 사용을 중단하고, 기존 Ionicons의 `calendar-outline`을 라이트/다크 테마 `primary` 색상으로 렌더링합니다.
- 그라데이션·그림자·추가 이미지 생성 없이 플랫 아웃라인으로 표시합니다.
- `ScreenIntro`의 기존 `artwork` API와 숨김 로직은 보존해 다른 화면에 영향이 없도록 합니다.
- 기존 상단 로고, 앱 아이콘, 스플래시, Android adaptive 및 Play 아이콘은 **변경하지 않습니다**.
- 홈 실제 일정·AI·알림 추천·빠른 입력 동작/시간대/저장 로직은 변경하지 않습니다.
- 10-B 회귀 테스트 신규 추가 및 HOME-01 기존 테스트 최신 스타일로 수정.

## 10-B 후속 미완료
- 브랜드 달력/체크 심벌의 실제 픽셀 원본 검토, 신규 평면형 원본 이미지 제작 및 승인.
- Android adaptive/monochrome, 스플래시 및 Google Play 이미지 교체 여부 최종 결정.
- 10-C 공통 UI, 10-D 화면 위계, 10-E 네이티브 스타일, 10-F 전체 QA는 아직 미진행.

## 병합·배포 안전 기준
10-A~10-F 통합 브랜치에서만 계속 작업하고, 최종 검증 전 `main` 병합 및 Play 자동 배포를 하지 않습니다. 기존 테스트 트랙과 브랜드 자산은 보존합니다.
