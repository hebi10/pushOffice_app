# PO-UI-08 · 최종 통합 QA와 릴리스 검증

> 기준: 2026-11-05 · Push Office 2차 리디자인 8/8단계
> 이 문서는 검증 증거와 남은 기기 검수 항목을 **분리**하여 관리합니다.

## 자동화 검증 보강

`tools/ui/verify_captures.py`는 에뮬레이터에서 실제로 생성된 `ui-captures/capture-manifest.json`을 읽습니다.

- 홈·캘린더·설정·네이티브 입력·일정 상세/선택 모달·반복 확인·삭제 확인·다크 모드·작은 화면의 필수 PNG가 누락되지 않았는지 점검합니다.
- 이미지가 PNG인지와 크기(최소 320px), 일반/소형 일정 상세 캡처의 폭 차이를 점검합니다.
- UI 캡처 워크플로에서 일부 화면 캡처 실패를 `warnings`에 남기고도 CI가 성공하는 일을 방지합니다.
- 검증 실패 시 스크린샷 워크플로를 실패 처리하되, `if: always()` 아티팩트 업로드는 유지하여 원인 조사에 사용할 수 있습니다.

## 단계별 증거

| 화면/기능 | 증거 및 확인 범위 | 보류 항목 |
|---|---|---|
| PO-UI-01~05 | 기존 각각의 PR, Node/TS/ESLint/Expo/Android 빌드 및 에뮬레이터 캡처 | 모든 제조사·해상도 조합 |
| PO-UI-06 | [PR #11](https://github.com/hebi10/pushOffice_app/pull/11), [검증](https://github.com/hebi10/pushOffice_app/actions/runs/42006089394), [34장 실제 화면](https://github.com/hebi10/pushOffice_app/actions/runs/42006089438); 캡처 로그의 작업 경고 0 | 실기기 키보드/초대형 글꼴 |
| PO-UI-07 | [PR #12](https://github.com/hebi10/pushOffice_app/pull/12); 오래된 브리핑·채팅/위젯 색상과 동작 회귀 보완 | 전체 CI 완료 및 실제 홈 위젯 설치·클릭, 보존 라우트 실화면 |
| PO-UI-08 | 필수 캡처 검증 스크립트 + GitHub Actions 게이트 추가 | 변경 후 검증 워크플로 실행 결과 |

## 실기기 QA 보류 (코드 검사 통과와 별개)

- 홈 위젯 2종 실제 런처 배치, 크기 조절, 2배 글자, 시스템 다크 모드, 텍스트/음성 클릭 이동 확인
- 태블릿 세로 배치, 큰 글꼴, 화면 회전, 키보드 가림, 접근성 스크린리더 사용
- 보존 브리핑·채팅 화면의 실제 데이터 0건, 로딩, 오류, 긴 한국어 텍스트, 공유/복사 수행 화면 검수
- 네이티브 음성 인식 및 기기 Gemini Nano 기능은 에뮬레이터 자동화만으로 정상 동작 확정 불가
- Google Play Console에 실제 AAB가 커밋된 것인지 확인. **GitHub Actions 성공 여부와 별도로 확인**

## Play 내부 테스트 게시

- 기존 `main`의 자동 빌드·서명 절차는 변경하지 않습니다.
- [2026-11-05 Play release 실행](https://github.com/hebi10/pushOffice_app/actions/runs/42004340442)은 성공으로 표시되었지만 `Publish selected test track and confirm committed release` 단계가 **skipped**였으므로 Play 업로드 완료로 취급할 수 없습니다.
- 테스트 트랙은 기존 **내부 테스트** 기본값을 유지하고, 비공개 테스트를 자동 발행하지 않습니다.
- 실제 게시 성공 여부는 GitHub Actions 출처·버전·게시 리포트 및 Play 내부 테스트 트랙 변경 상태를 대조해야 합니다.

## 완료 판정

자동 테스트, 타입·정적 분석, 번들, Android Kotlin/디버그 빌드, 캡처 검증의 모든 워크플로가 정상 종료되고 병합까지 확인해야 해당 자동 QA를 완료 처리합니다. 실기기·위젯·태블릿, Play 실제 업로드의 별도 검증이 빠졌다면 앱 전체의 최종 QA/배포가 완료되었다고 단정하지 않습니다.
