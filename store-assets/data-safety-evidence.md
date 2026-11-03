# Push Office — Play 데이터 보안 저장 결과와 근거

상태: **Play Console 데이터 보안 최종 저장 완료 · 검토 미전송**. 확인일: 2026-11-03. 앱: `com.hebi96.pushOffice_app`, 버전 `1.1.0`, 버전 코드 `3` (`app.json:5,22–24`)이다. 아래의 실제 저장 결과는 등록 담당자의 Console 확인에 따른다. 코드 감사와 SDK 공식 자료는 그 판단의 근거이며, 최종 AAB 및 기존 활성 배포 버전의 동작도 대조해야 한다.

## 이번 CI 빌드 범위와 실제 저장 결과

GitHub Actions 실행 [41588844929](https://github.com/hebi10/pushOffice_app/actions/runs/41588844929)는 마지막 확인 시 Gradle 진행 중이다. 이번 CI는 `EXPO_NO_DOTENV=1`이며 외부 브리핑 백엔드와 Firebase 환경값을 주입하지 않는다. 따라서 아래 저장 결과는 **해당 외부 기능이 구성되지 않은 이번 빌드**를 대상으로 한다. 소스에 선택 기능이 남아 있다는 사실과 실제 배포 환경에서 그 기능이 활성화되어 있다는 사실을 구별한다.

| 항목 | Console에 저장한 답변 |
| --- | --- |
| 수집 데이터 | 기기 또는 기타 ID, 진단 |
| 처리 | 수집, 공유 안 함, 임시 처리 아님, 필수 |
| 목적 | 분석(Analytics) |
| 전송 중 암호화 | 예 — 이번 빌드에서 활성인 ML Kit 공개 데이터 범위의 HTTPS 설명에 근거 |
| 새 계정 생성 / 외부 로그인 | 아니요 / 아니요 |
| 데이터 삭제 요청 배지 | 아니요 — 이메일 문의는 가능하나 운영자가 Google SDK 진단 삭제를 보장하는 경로는 없음 |
| 저장·제출 | 최종 저장 완료, 검토 미전송 |

공개 개인정보처리방침 [페이지](https://hebi10.github.io/pushOffice_app/privacy/)의 공개 브라우저 접근과 Console URL 저장을 확인했다. 지원 이메일 `asdlkj0104@gmail.com`도 저장·게시했다. 운영 주체는 GitHub hebi10의 Push Office 운영자다. main 게시 커밋은 [27cec8350052133916dd98978a280d40cc0fffd0](https://github.com/hebi10/pushOffice_app/commit/27cec8350052133916dd98978a280d40cc0fffd0)이다.

## 데이터 유형별 근거 및 조건부 기능

| 유형 | 수집 / 선택 여부 | 목적 | 근거 및 범위 |
| --- | --- | --- | --- |
| 기기 또는 기타 ID | **이번 빌드: 수집 / 필수 / 임시 처리 아님 / 공유 안 함** | 분석 | ML Kit GenAI의 식별자·설치 ID 공개. 홈/설정에서 SDK 준비 상태 자동 확인, 해당 SDK 경로를 끄는 설정 없음. 백엔드를 나중에 구성하면 선택적 `ownerId` 전송 및 앱 기능 목적도 재검토. |
| 진단 | **이번 빌드: 수집 / 필수 / 임시 처리 아님 / 공유 안 함** | 분석 | ML Kit의 기기·앱 정보, 지연 시간, API 설정, 입출력 크기, 기능 버전·이벤트·오류 코드·설정 언어. 임시 처리로 볼 보관 근거 없음. |
| 도시·관심 종목·뉴스 키워드 등 입력 설정 | **이번 CI: 외부 백엔드 미구성. 구성·직접 요청 시 선택적 전송** | 활성화 시 앱 기능 | 자유 입력은 ‘기타 사용자 제작 콘텐츠’가 가장 가까운 분류. 실제 위치로 제공된 도시는 ‘대략적인 위치’와 대조 필요. 기기 GPS 수집은 없음. |
| 이전 Firebase 사용자 ID·인증 관련 정보 | **이번 CI: Firebase 미구성. 설정 복구 시 조건부 처리** | 활성화 시 앱 기능·계정 복구 인증. 인증 서비스의 남용 방지 처리도 해당 가능 | Firebase가 구성되고 기존 사용 상태가 남아 있거나 재시도하는 경우 기존 사용자 복원 후 UID로 조회. 새 UI는 계정을 만들지 않음. 이전 사용자의 자동 복구 시도 가능성도 정책에 설명. |
| IP 주소 | **이번 CI의 미구성 외부 서버/이전 인증 경로에는 해당하지 않음. 활성화 시 처리** | 활성화 시 앱 기능, 요청 제한·보안 | 저장소 서버는 IP를 메모리의 요청 제한에 사용함. IP에서 위치를 유추하는 코드는 없음. 실제 인프라 로그 보관은 미확정. ML Kit 범위는 SDK 공식 자료에 따름. |

‘필수’는 모든 사용자가 같은 전송을 수행한다는 뜻이 아니라, 현재 앱에 해당 SDK 자동 진단 경로를 선택·거절하는 공통 제어가 없다는 판단이다. Google Play는 모든 사용자가 제공 여부를 선택할 수 있을 때에만 해당 유형을 ‘선택’으로 선언하도록 안내한다. 외부 기능을 나중에 구성하더라도 선택적 요청의 ID와 ML Kit 자동 처리의 ID를 같은 목적이라고 혼동하지 않는다.

## 수집·공유·보호 조치의 한계

- **‘수집 안 함’ 일괄 선택 불가.** 이번 빌드도 ML Kit 진단과 식별자를 수집한다.
- 이번 빌드에서 저장한 공유 안 함·전송 암호화 예는 ML Kit 공식 자료의 HTTPS·제삼자 미전달 및 외부 기능 미구성 범위에 근거한다. 모든 향후 구성·연동까지 같은 결론을 보장하지 않는다.
- 외부 브리핑 URL은 런타임 설정값이고 앱 코드가 HTTPS를 강제 검증하지 않는다. 백엔드를 활성화하면 실제 URL·처리자 관계·공유 예외·암호화 답변을 다시 확인해야 한다.
- 서버 코드가 도시·선택 유형을 로그에 남기므로 활성화된 외부 요청을 임시 처리로 일괄 선언할 수 없다. ML Kit·백엔드의 실제 보관 기간을 새로 약속하지 않는다.
- 공개 정책과 지원 이메일은 개인정보 문의 경로를 제공한다. 그러나 Google SDK 진단을 운영자가 삭제 보장하는 경로는 확인되지 않았고, 별도 서버 삭제 화면·계정 삭제 API도 없다. **Console 삭제 요청 배지는 아니요**로 저장했다. 수동 문의 경로와 삭제 보장·자동 기능은 구별한다.
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

1. 원래 업로드 키 확보·인증서 대조와 최종 GitHub Actions 빌드 완료. 새 AAB는 아직 업로드하지 않았다.
2. IARC 약관은 체크하지 않았다. 앱 검토 전송·출시도 하지 않았다.
3. 최종 AAB의 manifest/네이티브 Firebase 리소스·외부 환경값 미주입과 선언의 일치 여부. 대시보드에서 등록 작업 **10/11 완료**를 확인·캡처했으며 남은 등록 항목은 콘텐츠 등급(IARC 약관 미체크)이다.
4. 기존 활성 배포 버전 전체의 데이터 관행. 외부 백엔드·Firebase를 나중에 활성화하면 실제 URL·처리자 관계·서버/인프라 로그·이전 기록의 보관·삭제도 다시 확인해야 한다.

개인정보처리방침 공개 원본은 `docs/privacy/index.html`이고 `store-assets/privacy-policy-draft.ko.html`은 동일 내용의 **최종본** 복사본이다. 파일명만 이전 호환을 위해 유지한다. 초안 표시·미입력 연락처는 없으며, 공개 URL과 지원 이메일은 이미 저장·게시했다.
