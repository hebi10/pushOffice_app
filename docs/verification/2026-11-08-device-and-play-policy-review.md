# Push Office · Android 실기기 및 Google Play 정책 점검

점검 기준: 2026-11-08 KST
대상 PR: https://github.com/hebi10/pushOffice_app/pull/36
Android 앱: `com.hebi96.pushOffice_app`

## 확인된 결과

| 항목 | 결과 및 증거 |
| --- | --- |
| 기존 PR #36 통합 빌드 | Kotlin/React Native 검사와 Android UI 스크린샷 워크플로 통과: [Actions #42455028315](https://github.com/hebi10/pushOffice_app/actions/runs/42455028315), [#42455028327](https://github.com/hebi10/pushOffice_app/actions/runs/42455028327) |
| 추가 정책 보완 | 인앱 사전 고지·명시적 동의 화면, 정상 사용 홈에서 기능 안내, 모델 추론을 최상위 포그라운드로 제한 |
| 수정 버전 재검증 | CI 네트워크 연결 오류 발생 후 재검증. 최종 Actions 최신 실행 상태 확인 필요 |
| 실제 스마트폰 검증 | **미검증**. 연결된 실기기·ADB·관리형 물리 기기 테스트 장비 없음 |
| Google Play Console 앱 콘텐츠 | **실제 제출값 미확인**. 연결된 API는 Play 스토어 이미지 및 트랙 조회만 가능 |
| 갱신 개인정보처리방침 공개 | PR에서 `docs/privacy/index.html` 갱신. 공개 Pages에 최신 내용 반영 여부는 `main` 병합·Pages 게시 후 별도 확인 |
| 최신 비공개 테스트 업로드 | 별개 이슈. 기존 `alpha` 배포 #42435654824(재시도 포함)는 Play 게시 단계 HTTP 400 실패. 원인이 정책 때문인지는 확인되지 않음 |

## 관련 Google 공식 정책과 적용

1. **User Data / Prominent disclosure & consent**  
   다른 앱의 알림 제목·본문은 민감할 수 있습니다. 기존 설정 안내만으로는 부족하므로, 앱 홈에서 기능을 소개하고 Android 알림 접근 설정 직전 및 기능 활성화 직전에 별도의 고지·적극적 동의를 받도록 변경했습니다. 동의 거부 시 기능이 꺼진 상태로 유지되어야 합니다.  
   https://support.google.com/googleplay/android-developer/answer/10144311

2. **NotificationListenerService**  
   Android 시스템의 특수 알림 접근을 받아야 하며, 앱의 일반 `POST_NOTIFICATIONS` 권한과 다릅니다. manifest의 시스템 보호 서비스 권한과 접근 상태는 코드에서 확인했으나, 시스템 설정 화면·실제 수집 동작은 실기기에서 확인해야 합니다.  
   https://developer.android.com/reference/android/service/notification/NotificationListenerService

3. **ML Kit GenAI foreground restriction**  
   Gemini Nano 추론은 앱이 최상위 포그라운드일 때만 허용됩니다. 백그라운드 서비스에서 모델 추론을 실행하면 `BACKGROUND_USE_BLOCKED` 오류가 발생할 수 있습니다. 이에 따라 수신 시에는 기기 내 규칙 파서로 후보만 만들고, AI 분석은 사용자가 앱을 연 뒤 별도 실행하도록 수정했습니다.  
   https://developers.google.com/ml-kit/genai  
   https://developers.google.com/android/reference/com/google/mlkit/genai/common/GenAiException.ErrorCode

4. **Data safety 범위**  
   앱 안에서만 처리·저장되고 기기 외부로 나가지 않은 알림 원문은 Play 데이터 보안 정의상 원격 수집으로 신고할 필요는 없습니다. 그러나 ML Kit GenAI SDK의 기기·앱 식별자, 진단·사용량 정보, 그리고 기존 선택적 외부 브리핑/이전 Firebase 기능에서 기기 외부로 전송되는 데이터는 전체 앱 기준으로 다시 평가해야 합니다. **'데이터 수집 없음'으로 일괄 신고하면 안 됩니다.**  
   https://support.google.com/googleplay/android-developer/answer/10787469  
   https://developers.google.com/ml-kit/android-data-disclosure

5. **민감 정보 접근과 스토어 정보**  
   알림 분석은 선택 기능으로 설명해야 하며, 기능 설명/스토어 등록정보가 실제 앱 권한 목적과 일치해야 합니다. 현재 `store-assets/ko-KR/listing-candidate-20261108.json`에는 알림 기반 일정 후보 기능이 포함되어 있지 않아 공개 전 설명을 추가해야 합니다. 기존 이미지·텍스트를 임의로 교체하지 않습니다.  
   https://support.google.com/googleplay/android-developer/answer/16558241

6. **Play Console 콘텐츠**  
   비공개 테스트 트랙에도 Data safety 신고가 요구되며 내부 테스트만 활성인 앱은 적용 범위가 다릅니다. Play Developer API `applications.dataSafety`는 **POST 갱신 메서드**이므로 현 신고 내용을 확인하려고 호출하지 않습니다. 기존 데이터 보안 CSV를 근거 없이 생성/제출하면 안 됩니다.  
   https://support.google.com/googleplay/android-developer/answer/10787469  
   https://developers.google.com/android-publisher/api-ref/rest/v3/applications/dataSafety

## 실기기 필수 QA — 아직 수행되지 않음

| 검증 | 수행 방법과 합격 기준 |
| --- | --- |
| Google Play 서명 버전 | 기존 앱 데이터 보존. 삭제/재설치 요구 금지. 신규 테스트 트랙 활성화 또는 안전한 별도 테스트 단말 필요 |
| 알림 접근 거부 | 시스템 권한 거부·토글 OFF 시 다른 앱 알림의 후보를 저장하지 않아야 함 |
| 알림 접근 허용 | 사전 고지 후 OS 권한 설정 진입. 다시 앱에서 명시적으로 분석 기능 ON |
| 후보 생성 | 날짜·시간이 포함된 실제 알림을 보내고 앱 홈 및 설정에 1건의 후보가 나타나는지 확인 |
| 민감 알림 제외 | 인증 코드·금융 정보·광고 테스트 알림이 후보로 저장되지 않아야 함. 필터 완전성을 보장하지 않음 |
| 승인/거절 | 수정/저장 전 캘린더 등록 0건, 승인 후 정확히 1건, 거절하면 후보 제거. 재알림·중복·시간대 확인 |
| 권한 철회 | Android 설정에서 접근을 철회하면 신규 수집 중단. 기존 후보 삭제는 앱 기능 OFF로 실행 |
| 빠른 설정 타일 | 시스템 타일 추가, OFF 시 비활성화, ON 시 재배치·터치 실행·잠금 상태 확인 |
| Gemini Nano 다운로드 | 지원 모델·AICore 상태 확인 → `DOWNLOADABLE`에서 다운로드 → 진행률 → `AVAILABLE` → 앱 재시작 후 재확인 |
| 기기 미지원/실패 | `UNAVAILABLE`, `DOWNLOADING`, 네트워크·저장공간 오류 등에서 오해를 일으키지 않는 안내와 로컬 규칙 대체 확인 |
| 백그라운드 | 화면 OFF·앱 일반 종료·강제 종료·절전 모드 각각 구분. '항상 동작' 보장 없음 |

## Play Console에서 반드시 대조할 항목

- 앱 콘텐츠 → **데이터 보안**: 실제 현재 CSV/설문 응답과 ML Kit SDK 진단 수집, 외부 API 요청, Firebase 레거시 기능을 항목별 대조
- 앱 콘텐츠 → **개인정보처리방침**: 최신 URL에 알림 접근 및 보관·삭제 설명이 실제 공개됨을 확인
- 스토어 등록정보 → 설명: 선택형 알림 일정 후보 추천·기기 AI 제약을 정확하게 기재
- 정책 상태: 실제 경고/조치 요청 유무 확인. 공개 정책만으로 개별 계정의 위반 여부를 확정할 수 없음
- 테스트 트랙: 기존 비공개 `alpha` 업로드 HTTP 400 오류 별도 진단. 정책 원인이라고 추측하지 않음

## 출시 판단

**현 시점 결론: 배포 보류.** 코드 자동 검증이 통과해도 실기기 동작, Console 실제 Data safety 신고, 웹 개인정보처리방침 최신 공개 및 비공개 트랙 업로드가 확인되어야 비공개 테스트에 새 기능을 배포할 수 있습니다. `main`과 기존 사용자 일정·스토어 설명 이미지는 변경하지 않습니다.
