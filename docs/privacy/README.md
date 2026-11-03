# Push Office 개인정보처리방침 게시 자료

`index.html`은 공개용 한국어 개인정보처리방침이다. 운영 주체는 사용자가 지정한 **GitHub hebi10의 Push Office 운영자**, 연락처는 사용자가 제공한 **asdlkj0104@gmail.com**이다. 시행일·수정일은 2026-11-03이다. 앱 설정은 `com.hebi96.pushOffice_app`, 버전 1.1.0(코드 3)을 기준으로 대조했다. 이 디렉터리에서는 앱 소스·설정·배포 workflow를 변경하지 않는다.

문서에는 미입력 연락처, 초안 표시, 보관 기간·서버 위치의 임의 수치, 모든 데이터가 외부로 전송되지 않는다는 보장을 넣지 않았다. 실제 HTML은 외부 스크립트·폰트·분석 도구 없이 표시된다. 게시 자체와 공개 URL의 익명 접근 확인은 배포 작업에서 수행해야 한다.

## 핵심 근거

| 설명 | 소스 근거 |
| --- | --- |
| SQLite 일정과 입력 원문 `sourceText`, 설정·브리핑의 로컬 보관 | `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleStore.kt:12–20,57–63`, `src/features/storage/localStore.ts:9–11,95–129` |
| 무작위 앱 설치 UUID | `src/features/storage/storageMode.ts:19–22` |
| 음성은 기기 내 API·한국어 모델 확인, 온라인 인식 자동 대체 없음 | `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/QuickEntryActivity.kt:155–193`. 녹음 파일 저장/업로드 코드 없음. 저장된 텍스트 원문: `133–135`, 중지: `209–218` |
| 플랫폼 서비스의 외부 처리 가능성과 앱의 on-device API를 구별 | 아래 Android 공식 API 문서. 일반 서비스의 원격 처리 경고를 본 앱의 실제 음성 업로드라고 확대하지 않음. 모델 다운로드·제공자 자체 처리는 별도 범위로 설명. |
| ML Kit prompt beta5, 기기 내 입력 해석·요약 | `modules/push-office-native/android/build.gradle:18`, `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/NanoClient.kt:12–50` |
| SDK 준비 상태 자동 확인, 앱 내 공통 진단 거부 설정 없음 | `app/(tabs)/index.tsx:28–40`, `app/(tabs)/settings.tsx:30–32`. ID·진단 항목과 목적은 ML Kit 공식 공개 자료. |
| 외부 브리핑은 기본 꺼짐·직접 요청·구성된 서버 필요 | `src/store/slices/settingsSlice.ts:10`, `app/(tabs)/index.tsx:88–90`, `src/features/digest/digestService.ts:42–49` |
| 선택적 ownerId·날짜·시간대·도시·관심 종목·뉴스 설정 전송, 일정/음성 제외 | `src/features/digest/digestService.ts:11–22,45–49` |
| IP 요청 제한과 도시·선택 유형 로그. 실제 삭제 기한을 정하는 코드 없음 | `functions/src/index.ts:18–30,64–81`. 제한 창 60초는 정보가 60초 뒤 자동 삭제된다는 의미가 아님. |
| OpenWeather/NewsAPI/Alpha Vantage, 서버 설정에 따른 OpenAI 요약 | `functions/src/services/briefing.service.ts:65–87,116–117`, `functions/src/utils/ai.ts:35–74,107–135` |
| 이전 Firebase 사용 상태 복구, 기존 계정 읽기만, 원격 원본 보존 | `src/features/storage/recoveryPolicy.ts:9–14,24–28,47–66`, `src/features/storage/legacyRecovery.ts:18–34`, `app/(auth)/sign-in.tsx:14–16` |
| 로컬 삭제와 이전 원본 보존·자동 백업 끔 | `modules/push-office-native/android/src/main/java/expo/modules/pushoffice/ScheduleRuntime.kt:14–17`, `README.md:30–34`, `app.json:23` |

## 확인한 공식 링크

2026-11-03 웹 조회에서 아래 5개 문서가 열리는 것을 확인했다. HTML에는 같은 URL과 제공된 이메일의 `mailto:` 링크만 사용했다.

- [Android SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer): 일반 음성 서비스의 원격 처리 설명, `createOnDeviceSpeechRecognizer`의 기기 내 인식 경로와 모델 다운로드 API를 구별.
- [ML Kit Android 데이터 공개](https://developers.google.com/ml-kit/android-data-disclosure): GenAI 식별자·진단·설정 언어, HTTPS·제삼자 미전달. 최신 SDK 기준 자료이며 beta5의 독립적인 보관 기간을 뜻하지 않음.
- [ML Kit 개인정보 설명](https://developers.google.com/ml-kit/terms): 입력·출력의 기기 내 처리와 별도 성능·사용 지표 전송.
- [Google 개인정보처리방침](https://policies.google.com/privacy): Google의 정보 처리·보관·관리 정책.
- [Firebase 개인정보 및 보안](https://firebase.google.com/support/privacy): Firebase 서비스 처리 관계. JavaScript 복구 동작을 네이티브 FCM 자동 초기화와 혼동하지 않음.

## 배포 시 확인할 최소 사항

1. **공개 URL:** 배포 완료 후 로그인 없이 `index.html`의 실제 페이지가 열리는 URL을 확인하여 Play Console과 앱의 정책 링크에 사용한다. 이 문서 작성만으로 게시 완료를 주장하지 않는다.
2. **외부 기능을 실제 활성화하는 경우:** 사용되는 백엔드 주소·HTTPS, 서버/인프라 로그와 이전 Firebase 기록의 실제 보관·삭제 절차, 처리 사업자·서버 위치를 운영자가 확인해야 한다. 현재 정책은 모르는 위치·기간을 만들어 적는 대신 조건과 범위를 공개한다.
3. **문의 및 삭제 요청 처리:** 제공된 이메일을 운영자가 실제 확인해야 한다. 문서는 개인정보 문의·삭제 요청을 보낼 연락처를 제공하지만 자동 원격 삭제 기능이나 처리 완료 기한을 약속하지 않는다. Play의 삭제 요청 답변은 이 수동 연락 경로의 실제 운영 가능 여부와 일치시킨다.

정적 검증 대상: HTML 태그 균형·한국어/viewport·제목·운영 주체·이메일·필수 처리 범위·초안/placeholder 제거·외부 스크립트 없음·참조 소스 경로 존재. 브라우저 렌더링 및 배포는 이 문서 작업의 범위 밖이다.
