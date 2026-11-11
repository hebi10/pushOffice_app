# Push Office — 2026-11-11 스토어 8장 최종 시각·무결성 QA

## 검증 결론
- 최신 실제 Android 소스 commit `fd0b5a2118c352d442135308e2b1360e1beba599`
- Android API 29 에뮬레이터 실제 UI 캡처 실행: https://github.com/hebi10/pushOffice_app/actions/runs/42952209462
- 원본 UI 아티팩트: `PushOffice-UI-screenshots` (ID `13826009501`), **59장**, `capture-manifest.json` warnings **0**
- 생성된 8장/대표 그래픽: `PushOffice-store-refresh-eight-preview` (ID `13827020433`)
- 이전 시안이 아닌 해당 **최신 실행**에 생성된 이미지를 대상으로 검증
- 전체 React Native/Kotlin UI validation: https://github.com/hebi10/pushOffice_app/actions/runs/42952209438 (**success**)

## 실제 검증
1. 원본 ZIP·포스터 ZIP 각각 압축 무결성 검사 통과.
2. `manifest.json`: 앱 `com.hebi96.pushOffice_app`, 언어 `ko-KR`, source SHA 및 Actions run ID, 8장 완료 표시.
3. 8개 PNG 각각 **1080×1920, RGB**, 고유 순서, SHA-256 완전 일치.
4. 각 PNG 내부의 휴대전화 화면 픽셀 영역을 해당 Android 실캡처 원본의 동일한 Lanczos 크기 조정 출력과 독립적으로 비교. **8/8 픽셀 완전 일치**. 앱 화면을 임의로 재창작하거나 보정하지 않았음.
5. 대표 그래픽 **1024×500, RGB**, SHA-256 일치. 기존 10-B 앱 디자인과 동일한 달력·체크 마크.
6. 스토어 아이콘은 기존 10-B 512×512 RGBA, **SHA-256 `01b40efbf483830618d8e932d7afeeef7fa4f7ff602eb15cf00b455665eed803`** 기준.
7. 8장 전체 연락처/개인 식별정보 없음. UI의 `UITest`·`TodayQA` 일정은 테스트용 예시이며 캡션에 구분.
8. 한국어 헤드라인·서브 카피와 실제 기기 프레임/안드로이드 화면 시각 대조: **문구 잘림·레이아웃 오류 관찰되지 않음**. 07·08은 실제 기기 AI 모델 관리의 다크 화면이며, 일부 모델은 미설치/지원 불가로 표시됨. 광고문구에서 다운로드·추론 성공을 주장하지 않음.

## 8장 파일 및 출력 SHA-256

| 순번 | 파일 | SHA-256 |
|---|---|---|
| 01 | 01-home-briefing.png | `7e4c72491672d14fbbe0a782d21a9228fe788b41603ec9b9b15afee6a39ecb75` |
| 02 | 02-calendar.png | `c2c6a2bb67941046f82bd283055bcf63c2ec5fcf0a986bc2bcaac52c8e753d18` |
| 03 | 03-quick-entry.png | `ad0b96d412337efb3f62ec899b49cc6532e7552bd39339952c18b56cb3086264` |
| 04 | 04-save-confirmation.png | `4ee6536d5133d6ced52b4372b550c13ee0d854f2c7ed29fa310a8c71cb98a4a8` |
| 05 | 05-schedule-detail.png | `3e96c3e188146d85bbbd199a90d879f3b9af2c3fd1b8c59390a1b0fc54699cbf` |
| 06 | 06-notification-settings.png | `cdae2e5823329038a0b8831e8553d580eb3692616d1107b53dc6f5626da3e7f0` |
| 07 | 07-ai-model-overview.png | `85c1904d94262881da7dca057617bccbb7574e6f920b2dc43c4ad4ac0d5941c3` |
| 08 | 08-ai-model-details.png | `b8394834437c18bb46f1cab33b013d6f3ec322e0d28d7d2bfb7886831ec3cf5b` |

대표 그래픽 SHA-256: `7f5bda510d887786920a566af684688a0e526dde2c478cc4f14a1021b7002c7b`.

## 배포 조건
- 모든 자산이 PR의 `screenshots-refresh-20261111/`, `feature-graphic-refresh-20261111.png`, `refresh-manifest-20261111.json`에 업로드된 상태로 최신 CI에서 검증되어야 함.
- **Play Console 이미지 6→8장, 아이콘·대표 그래픽 교체 이외의 필드는 변경하지 않음**.
- 앱 코드, AAB, 서명, 패키지, 기존 비공개/내부 테스트 트랙을 보존.
- Play API 신규 edit에서 icon 1/feature 1/screenshot 6개를 대조한 뒤 변경, commit `ERROR_IF_IN_REVIEW` 가드.
- 새 edit 재조회에서 **icon 1/feature 1/screenshot 8개와 이미지 ID/순서, 기존 스토어 텍스트 동일함을 검증**한 경우에만 게시 완료로 보고.
- Google 심사·스토어 실제 사용자 노출은 API 저장 성공과 별도.
