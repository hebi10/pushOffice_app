# Push Office — Mono Office 10-B 브랜드마크·평면 일러스트 리디자인

기준일: 2026-11-08. 기획: [Google Drive Mono Office 10-A~10-F](https://docs.google.com/document/d/1T5X0QDswTEjC2FrUzWmmHjzPfaRjmUHsgni8a_TKa24/edit).

## 작업 내용
- 기존 달력·체크 브랜드 심벌의 의미를 유지하면서 그림자·그라데이션·입체 광택 없는 평면형 아웃라인으로 재제작했습니다.
- 라이트 아이콘 배경 `#F7F8FA` / 선 `#23262B`, 다크 아이콘 배경 `#111315` / 선 `#E7E9EC` 기준을 사용합니다.
- 앱 런처 아이콘, adaptive foreground/monochrome, 스플래시 라이트/다크, favicon, 브랜드 헤더 마크를 10-B 이미지로 교체합니다.
- 홈 배경 일러스트를 PNG 평면형 달력·체크로 변경하고 `ScreenIntro.monochromeArtwork`에서 `colors.primary`로 틴트해 다크 모드에서도 표시합니다. 기존 `graphicIcon` 및 JPG fallback 동작은 보존합니다.
- 홈/캘린더/알림/설정/빠른 입력용 통일된 소형 일러스트 5종 준비. 현재 실제 화면에는 홈과 Android 네이티브 빠른 입력 시트에만 적용; 다른 라우트의 UI 구조는 10-D 이후 보정합니다.
- Android `drawable-nodpi/quick_entry_mono.png` 및 `drawable-night/quick_entry_mono.png`로 빠른 입력 선택 시트의 입체형 JPEG를 교체하고 다크에서 이미지 숨김을 해제합니다.
- 기존 화면 3탭, 권한·저장·반복·알림·음성·Gemini Nano·위젯 클릭 경로 및 로컬 데이터 로직은 변경하지 않습니다.
- 기존 배포용 Play 스토어 그래픽 및 스크린샷은 건드리지 않습니다. `store-assets/ko-KR/app-icon-10b-candidate.png`는 검토용 후보이며 Play Console에 업로드하지 않습니다.

## 생성·검증
- 재현 가능한 원본 생성 코드: `tools/generate_mono_office_assets.py`. Pillow를 이용한 PNG 래스터 생성으로 별도 SVG·폰트·신규 React Native 의존성을 요구하지 않습니다.
- `tests/ui-mono-office-stage10b.test.mjs`: 홈·테마·브랜드·네이티브 동작 보존.
- `tests/ui-mono-office-stage10b-assets.test.mjs`: 파일 수·PNG 헤더·해상도·라이트/다크 분기·패키지/버전 불변 검사.
- Google Drive [10-B PNG 자산 ZIP](https://drive.google.com/file/d/1-KHZfUie9blYPL1xu3pn4zuZCyNCuWHM/view). PR 및 Android Actions의 커밋 SHA별 QA와 구분.
- 검증 상태는 GitHub Actions 완료 후 갱신합니다. 자동 빌드 성공과 실제 기기 검증은 별개입니다.

## 안전 경계
- `main` 병합 및 Play 내부·비공개 배포 금지. 10-C~10-F 통합 후 사용자 승인/검증에 따라 최종 반영합니다.
- 기존 `tools/export_brand_assets.py`는 과거 Play 그래픽 익스포트용이므로 실행 시 새 로고 PNG를 덮어쓸 수 있습니다. Mono 최종 스토어 그래픽 갱신 전까지 실행하지 않습니다.

### 사용자 지정 테마 검증 보강
Android drawable-night만 이용할 경우 시스템 모드와 앱에서 직접 설정한 테마가 다를 때 색상이 어긋날 수 있습니다. `QuickEntryActivity`는 `isDark`를 기준으로 PNG를 직접 틴트(`#23262B` / `#E7E9EC`)합니다. 리소스 폴더의 day/night PNG와 별개로 사용자 테마 선택 시 대비가 유지됩니다.
