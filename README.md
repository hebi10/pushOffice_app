# Push Office

기기에 저장하는 한국어 일정 비서입니다. Expo SDK 54 / React Native 앱과 로컬 Kotlin Expo 모듈을 함께 사용합니다. 새 설치는 로그인과 Firebase 키 없이 시작합니다.

## 실행

```bash
npm ci
npm run android
```

Expo Go에는 앱 전용 네이티브 모듈이 없습니다. Android development/debug 빌드를 설치해 주세요. 앱 ID는 `com.hebi96.pushOffice_app`, 딥 링크 스킴은 `pushofficeapp`입니다. 최소 Android 8.0(API 26)입니다.

`plugins/with-local-assistant.js`가 prebuild 때 `android.minSdkVersion=26`, `android.kotlinVersion=2.4.0`을 유지합니다. 루트 Kotlin Gradle plugin도 해당 속성으로 명시적으로 버전을 선택하며, Expo 루트 플러그인 적용 전에 `ext.kspVersion=2.3.10`을 설정합니다. Kotlin 2.4.0은 ML Kit GenAI beta5의 Kotlin 메타데이터에 맞춘 컴파일러 설정이며 Expo SDK는 54를 유지합니다. `app.json`의 `android.allowBackup=false`도 생성된 Android 앱에 적용됩니다.

## GitHub에서 AAB 빌드

[Android release bundle](https://github.com/hebi10/pushOffice_app/actions/workflows/android-release.yml)의 **Run workflow**로 빌드합니다. EAS 서비스와 Expo 로그인 없이, 저장소의 Expo CLI로 Android 프로젝트를 생성하고 Gradle을 실행합니다. 기존 업로드 키가 없으면 결과는 명시적인 미서명 AAB이며 Play 업로드용으로 사용할 수 없습니다. 서명 키 설정과 인증서 검증 방법은 [CI 안내](tools/ci/README.md)에 있습니다.

현재 GitHub 빌드는 `.env`를 읽지 않으며 외부 브리핑·Firebase 환경값을 주입하지 않습니다. 외부 기능을 활성화할 때는 실제 서버 처리와 Play 데이터 보안 답변을 다시 확인해야 합니다.

[개인정보처리방침](https://hebi10.github.io/pushOffice_app/privacy/) · 지원: [asdlkj0104@gmail.com](mailto:asdlkj0104@gmail.com). 앱 설정에서도 방침과 지원 문의를 열 수 있습니다.

## 사용

- 홈에서 오늘의 로컬 브리핑과 다음 일정을 확인하고 **텍스트 · 음성으로 일정 추가**를 누릅니다.
- 입력 창에서 텍스트 또는 음성을 선택하고 날짜·시간 미리보기를 확인한 뒤 저장합니다. 음성은 버튼을 직접 누를 때만 시작합니다.
- 달력은 매월·매년 반복을 해당 날짜에 표시합니다. 월말과 윤년은 해당 달 말일로 보정하며 원래 반복 기준 날짜와 IANA 시간대(`anchorZone`)를 보존합니다. 기기 시간대가 바뀌어도 원래 시간대에서 반복을 계산하고 현재 화면 시간대로 표시합니다. DST의 없는 시간은 전환 간격만큼 앞으로 이동하고, 겹치는 시간은 이른 시각을 선택해 네이티브 동작과 맞춥니다.
- 일정 상세에서 시간·제목·알림·반복을 수정하거나 10분 재알림을 예약합니다. 반복 일정 수정과 삭제는 전체 반복에 적용됨을 확인합니다.
- 설정의 타일 추가는 Android 시스템 응답을 표시합니다. 위젯 추가는 런처에 요청한 뒤 사용자가 시스템 확인 창에서 완료합니다. 직접 홈 화면을 길게 누른 뒤 Push Office 위젯을 선택할 수도 있습니다.
- 알림 권한은 설정에서 요청합니다. 정확한 알람을 사용할 수 없으면 일반 알람으로 예약하며 절전 상태 등에 따라 시간이 늦어질 수 있습니다.
- 아침 브리핑은 네이티브 Android 알람에서 로컬 일정으로 생성합니다. 앱이 실행 중이지 않아도 예약되며 AI 실행에 의존하지 않습니다.

## 로컬 데이터와 이전 데이터

일정의 기준 저장소는 네이티브 SQLite입니다. 앱, 빠른 입력, 타일, 위젯과 알람 수신기가 같은 기록을 사용합니다. 기존 공개 `ScheduleDoc`/query hook 형태는 어댑터에서 Firebase Timestamp 형태로 복원합니다. 네이티브 입력 기록은 서로 다른 userId가 있어도 이 기기에서 함께 표시합니다. 앱 복귀와 네이티브 변경 이벤트에서 화면을 갱신합니다.

기존 AsyncStorage 일정은 원본을 보존하고 ID가 같은 항목을 덮어쓰지 않는 import로 한 번만 가져옵니다. 이전 저장 모드가 Firebase이면 활성 모드는 즉시 local로 바꾸고 별도의 가져오기 대기 메타데이터를 보존합니다. 기기 ID와 저장된 알림 설정을 적용하고 앱을 연 뒤 백그라운드에서 복구를 시도하므로 네트워크나 로그인 상태가 로컬 사용을 막지 않습니다. 설정이나 기존 계정이 없거나 읽기에 실패해도 대기 상태와 원본은 유지됩니다. 설정의 **이전 Firebase 일정 가져오기 다시 시도**로 재시도할 수 있습니다. 새 익명 계정을 자동 생성하거나 원격 데이터를 수정·삭제하지 않습니다.

가져오기 성공 마커는 알림 정리 전에 별도로 기록합니다. 정리에 실패한 뒤 사용자가 로컬 일정을 삭제해도 다음 실행에 다시 가져오지 않습니다. 가져온 기록의 기존 Expo notificationId만 취소하고, 모든 적용 가능한 원본을 성공적으로 가져온 뒤에만 이전 일일 브리핑·백그라운드 작업을 정리합니다. 알림 정리는 독립적으로 재시도하며 이미 가져온 클라우드 기록은 설정·로그인이 없어져도 네트워크 없이 정리할 수 있습니다.

Firebase App/Auth/Firestore 초기화는 명시적인 기존 계정 가져오기나 클라우드 서비스 호출 때까지 지연됩니다. 기본 로컬 경로는 Firebase 키가 있어도 Firebase 인증을 시작하지 않습니다. Android 자동 백업은 사용하지 않으므로 기기를 바꾸거나 앱을 삭제하면 로컬 데이터는 자동 복구되지 않습니다. 이전 Firebase 원본은 계속 보존됩니다.

## 음성과 Gemini Nano

한국어 기기 내 음성 인식과 Gemini Nano는 지원 기기·시스템 모델이 필요합니다. 실제 ML Kit 상태가 사용 가능할 때만 홈의 **기기 AI로 다듬기**를 제공합니다. 모델 미설치·지원 불가·오류 상태는 그대로 표시하며 기본 입력과 결정론적 요약은 계속 사용할 수 있습니다. 음성과 일정 텍스트를 외부 AI로 자동 전송하지 않습니다. 에뮬레이터에서 Nano와 기기 내 음성 인식을 검증할 수 없으면 호환 실기기 검증이 필요합니다.

날씨·뉴스·주식은 선택 기능입니다. 초기값은 모두 꺼져 있습니다. 설정에서 항목·도시·관심 종목 등을 선택하고 홈의 **외부 브리핑 불러오기**를 직접 누를 때만 기존 외부 서비스를 호출합니다. `EXPO_PUBLIC_FUNCTIONS_BASE_URL` 설정이 필요하며 선택 설정만 전송하고 일정 내용은 포함하지 않습니다. 외부 정보 없이도 모든 로컬 일정 기능을 사용할 수 있습니다. 기존 `functions/` 서버 코드는 유지합니다.

## 확인

Node 24 이상에서 아래 명령을 실행합니다.

```bash
npm run typecheck
npm run lint
npm test
```

Node 테스트는 prebuild 설정의 중복 방지와 Kotlin/KSP 적용 순서, Timestamp와 시간대 메타데이터 왕복, 월말·윤년·DST 반복, 정리 실패 후 삭제한 기록의 재등장 방지, 활성 로컬 모드와 복구 대기 상태 분리, 클라우드 지연·실패 중 저장된 설정과 UI 제공, 설정·인증 복구 후 재시도, 로컬 브리핑의 로컬 저장, OS 설정 복귀 시 권한 새로고침을 검사합니다. 네이티브 저장소·파서·알람 테스트와 빌드 방법은 [`modules/push-office-native/README.md`](modules/push-office-native/README.md)를 참고하세요.
