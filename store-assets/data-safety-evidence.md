# Push Office — Play 데이터 보안 근거 초안

상태: **DRAFT · 제출 전 검토용 · 공개 정책 미게시**. 감사일: 2026-11-03. 앱: `com.hebi96.pushOffice_app`, 소스 설정 버전 `1.1.0`, 버전 코드 `3` (`app.json:5,22–24`). 아래는 코드와 SDK 공식 공개 자료에 근거한 입력 제안이며, 운영자의 실제 배포·보관·삭제 방침을 대신하지 않는다. 최종 AAB와 활성 배포 버전의 동작도 대조해야 한다.

## 권장 데이터 유형과 목적

| 유형 | 수집 / 선택 여부 | 목적 | 근거 및 범위 |
| --- | --- | --- | --- |
| 기기 또는 기타 ID | **수집 / 필수**로 보는 것이 보수적 | 분석. 외부 브리핑에는 앱 기능 목적도 적용 | ML Kit GenAI의 식별자·설치 ID 공개. 홈/설정에서 SDK 준비 상태 자동 확인, 해당 SDK 경로를 끄는 설정 없음. 외부 브리핑의 `ownerId`는 별도의 선택적 전송. |
| 진단 | **수집 / 필수**로 보는 것이 보수적 | 분석 | ML Kit의 기기·앱 정보, 지연 시간, API 설정, 입출력 크기, 기능 버전·이벤트·오류 코드·설정 언어. 진단을 임시 처리로 볼 보관 근거 없음. |
| 도시·관심 종목·뉴스 키워드 등 입력 설정 | **수집 / 선택** | 앱 기능 | 사용자가 직접 외부 브리핑을 요청할 때 전송. 자유 입력은 ‘기타 사용자 제작 콘텐츠’가 가장 가까운 분류. 실제 위치로 제공된 도시는 ‘대략적인 위치’와 대조 필요. 기기 GPS 수집은 없음. |
| 이전 Firebase 사용자 ID·인증 관련 정보 | **조건부 수집 / 선택적 복구 기능** | 앱 기능·계정 복구 인증. 인증 서비스의 남용 방지 처리도 해당 가능 | 기존 Firebase 사용 상태 또는 재시도에 한정. Firebase Auth 기존 사용자 복원 후 UID로 Firestore 조회. 새 UI는 계정을 만들지 않음. 이전 사용자의 자동 복구 시도 가능성도 정책에 설명. |
| IP 주소 | 외부 서버/이전 인증 서비스 사용 시 처리 | 앱 기능, 요청 제한·보안 | 외부 요청 IP를 서버가 받음. 저장소 서버는 IP를 메모리의 요청 제한에 사용함. IP에서 위치를 유추하는 코드는 없음. 실제 인프라 로그 보관은 미확정. |

‘필수’는 모든 사용자가 같은 전송을 수행한다는 뜻이 아니라, 현재 앱에 해당 SDK 자동 진단 경로를 선택·거절하는 공통 제어가 없다는 판단이다. Google Play는 모든 사용자가 제공 여부를 선택할 수 있을 때에만 해당 유형을 ‘선택’으로 선언하도록 안내한다. 외부 브리핑의 ID만 선택 사항이어도 같은 데이터 유형의 ML Kit 자동 처리까지 선택으로 바뀌지는 않는다.

## 수집·공유·보호 조치의 한계

- **‘수집 안 함’ 일괄 선택 불가.** ML Kit 진단과 식별자, 선택적 외부 브리핑 설정 전송이 있다.
- ML Kit 공식 자료는 SDK 데이터의 HTTPS 전송과 제삼자 미전달을 설명한다. 앱 전체의 ‘공유 안 함’은 외부 백엔드 사업자, 처리자 관계, 실제 연동 설정을 확인한 후 확정해야 한다. 서비스 제공자 예외와 사용자가 시작한 전송의 예외는 Play 정의와 대조한다.
- 외부 브리핑 URL은 런타임 설정값이고 앱 코드가 HTTPS를 강제 검증하지 않는다. **모든 데이터의 전송 암호화 여부는 실제 배포 URL 확인 전 미확정**이다.
- 서버 코드가 도시·선택 유형을 로그에 남기므로 전체 요청을 임시 처리로 일괄 선언할 수 없다. ML Kit·백엔드의 실제 보관 기간을 새로 약속하지 않는다.
- 별도 서버 데이터 삭제 화면·계정 삭제 API·온라인 삭제 요청 양식은 없다. **데이터 삭제 요청 제공 여부를 ‘예’로 선택할 근거가 없다.** 지원 이메일·삭제 절차 확인 후 재검토한다.
- 크래시 스택 수집 근거가 없어 ‘크래시 로그’를 자동 추가하지 않는다. 공개된 기술 성능 항목은 ‘진단’으로 설명 가능하므로 ‘기타 앱 성능 데이터’를 중복 추가할 명확한 근거도 없다. ML Kit 사용 이벤트를 ‘앱 상호작용’으로 보는 것은 분류 해석이며, 앱의 사용자 탭 추적이 구현되었다는 근거는 아니다.
- 광고 SDK·광고 표시·광고 ID 사용 코드가 없다. 광고 포함 여부: **아니요**가 현재 구현과 부합한다. 독립 보안 심사·별도 로컬 암호화·모든 통신의 안전성을 입증한 것으로 표시하지 않는다.

## 코드 근거

| 확인 사항 | 소스 |
| --- | --- |
| SQLite 일정, 제목/시간/반복/알림/입력 원문 `sourceText` 저장 | `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleStore.kt:12–20,57–63` |
| 로컬 일정 수정·삭제 및 실제 알림 삭제 | `src/features/schedules/scheduleService.ts:42–58`, `app/schedule/[id].tsx:71`, `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleRuntime.kt` |
| 앱 설정·브리핑은 AsyncStorage, 무작위 UUID 생성·저장 | `src/features/storage/localStore.ts:9–11,95–109,114–129`, `src/features/storage/storageMode.ts:19–22` |
| 음성은 명시적 버튼, 기기 내 한국어 인식, 온라인 대체 없음; 오디오 파일 저장/전송 코드 없음 | `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt:75,155–193,209–218`. 인식 텍스트는 일정 원문으로 저장될 수 있음: `133–135` |
| ML Kit GenAI prompt beta5 사용, 기기 내 추론 | `modules/push-office-native/android/build.gradle:18`, `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NanoClient.kt:12–24,26–50` |
| SDK 상태 확인의 자동 호출 | `app/(tabs)/index.tsx:28–40`, `app/(tabs)/settings.tsx:30–32` |
| 외부 항목 기본 꺼짐, 홈에서 직접 요청 | `src/store/slices/settingsSlice.ts:10`, `app/(tabs)/index.tsx:88–90` |
| 외부 POST 전체 입력: ownerId/ownerType/dateKey/timezone/types/city/stockTickers/newsKeywords/newsLanguage, 일정 내용 없음 | `src/features/digest/digestService.ts:11–22,42–49` |
| 외부 브리핑 결과도 로컬 저장 | `src/features/digest/digestWorkflow.ts:15–25`, `src/features/digest/digestService.ts:69–82` |
| 요청 IP 기반 메모리 제한, 도시·선택 유형 서버 로그 | `functions/src/index.ts:18–30,64–81` |
| 선택적 날씨/뉴스/주식 서버 호출, OpenAI 설정 시 외부 결과 요약 | `functions/src/services/briefing.service.ts:79–117`, `functions/src/utils/ai.ts:35–74,107–135` |
| 기본 시작은 로컬, Firebase 초기화 지연 | `src/features/auth/useAuthInit.ts:16–25`, `src/lib/firebase.ts:14–33` |
| 기존 Firebase 계정·설정·일정 읽기만 수행, 새 계정 없음 | `src/features/storage/legacyRecovery.ts:18–34`, `app/(auth)/sign-in.tsx:14–16`. 사용되지 않는 이전 `signInAnon` 함수의 존재와 UI 호출은 구별해야 함. |
| 이전 Firebase 원본/가져오기 원본 보존, 앱 삭제가 원격 삭제를 뜻하지 않음 | `README.md:30–34`, `src/features/storage/nativeStore.ts:9–18`, `app/(tabs)/settings.tsx:95–102` |
| Android 자동 백업 끔, 불필요한 카메라/저장소/오버레이 권한 차단 설정 | `app.json:23–29`. 최종 AAB manifest에서 결과 재확인 필요. |

## 패키지 내 네이티브 Firebase: 존재와 활성화 구분

초기 감사 시 존재하던 release APK를 `aapt2 dump resources`로 검사했을 때 `google_app_id`, `google_api_key`, `gcm_defaultSenderId`, `project_id`, `google_storage_bucket`, `firebase_database_url` 리소스가 모두 없었다. 저장소에 `google-services.json`과 Google services Gradle plugin 적용이 없고 앱·사용자 네이티브 모듈에서 수동 `FirebaseApp.initializeApp`/`FirebaseOptions` 호출도 발견하지 못했다. 설정값·키·환경 변수 값은 출력하지 않았다.

공식 Firebase API 문서는 application ID가 리소스에 없으면 `FirebaseOptions.fromResource()`가 null을 반환하고, 기본 `FirebaseApp.initializeApp(context)`는 리소스 설정이 없으면 null을 반환한다고 설명한다. 따라서 이 APK에서 `FirebaseInitProvider`, Messaging, Installations 컴포넌트의 manifest 존재만으로 네이티브 FCM/FIS 수집 활성화를 단정하지 않는다. 연결된 기기가 없어 이 감사에서 런타임 로그를 재확인하지는 못했다. **최종 1.1.0(코드 3) AAB에 설정이 추가되지 않았는지 재검증해야 한다.** JavaScript 기반 이전 계정 복구와 ML Kit 자체 진단 전송은 이 기본 네이티브 Firebase 초기화 여부와 별개다.

나중에 네이티브 FCM/FIS를 실제 설정하면 FCM 앱 버전/user-agent, FIS 설치 ID/user-agent 등의 공식 공개 범위를 다시 반영한다. 진단·공유 설정에 대한 추측으로 비활성화를 주장하지 않는다.

## 공식 자료

- [ML Kit Android 데이터 공개](https://developers.google.com/ml-kit/android-data-disclosure): `genai-prompt` 명시, 식별자·진단·설정 언어, HTTPS·제삼자 미전달. 최신 SDK 기준 문서이며 beta5만의 보관 기간을 확정하지 않음.
- [ML Kit 약관 및 개인정보](https://developers.google.com/ml-kit/terms): 실제 입력/출력은 기기 내 처리, 성능·사용 지표는 Google로 전송.
- [Firebase Android 데이터 공개](https://firebase.google.com/docs/android/play-data-disclosure): Messaging, Installations 및 사용별 인증/Firestore 공개 범위. Android SDK 자료를 JavaScript 복구 구현과 혼동하지 않음.
- [FirebaseOptions](https://firebase.google.com/docs/reference/android/com/google/firebase/FirebaseOptions) 및 [FirebaseApp](https://firebase.google.com/docs/reference/android/com/google/firebase/FirebaseApp): 기본 리소스 초기화 조건.
- [FCM 자동 초기화 제어](https://firebase.google.com/docs/cloud-messaging/android/get-started): 구성된 FCM의 자동 초기화 및 등록 동작.
- [Google Play 데이터 보안 양식](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en): SDK 전송도 수집에 포함, 로컬 전용 처리는 제외, 임시 처리·선택 여부·공유 예외 정의.
- [Android 데이터 유형 안내](https://developer.android.com/privacy-and-security/declare-data-use): 진단·기기 ID·입력 콘텐츠 등의 분류.

## 제출 전 미확정 사항

1. 공개할 개인정보처리방침 URL 및 운영자 정보: **[공개 개인정보처리방침 URL 확인 필요]**, **[운영자 정보 확인 필요]**.
2. 지원·개인정보 연락처: **[지원 이메일 확인 필요]**. 없는 연락처·삭제 양식·서비스 약속을 만들지 않는다.
3. 실제 배포 백엔드 URL과 HTTPS 여부, 외부 서비스 실제 사용 설정, 처리자 관계, 서버·인프라 로그의 보관 기간·삭제 절차.
4. 이전 Firebase 기록의 실제 운영·보관·삭제 절차, 활성 배포 버전 전체의 데이터 관행.
5. 최종 AAB의 manifest/네이티브 Firebase 리소스와 선언 일치 여부.

개인정보 안내의 검토용 HTML은 `store-assets/privacy-policy-draft.ko.html`이다. 이 파일은 아직 외부에 게시하지 않았으며, DRAFT 표시와 미확정 항목을 포함한다.
