# GitHub Actions에서 Android AAB 만들기

GitHub의 **Actions → Android release bundle → Run workflow**를 실행합니다. Node 22와 Java 17에서 `npm ci` → 로컬 Expo CLI의 Android prebuild → Gradle `bundleRelease`를 실행합니다. Expo 프레임워크는 유지하지만 EAS 서비스나 Expo 로그인은 사용하지 않습니다. `EXPO_NO_DOTENV=1`로 로컬 `.env`를 읽지 않고 외부 backend/Firebase 설정 없이 빌드합니다. 생성되는 `android/`는 Git에 추가하지 않습니다.

버전은 `app.json`의 `expo.version`과 `expo.android.versionCode`를 사용합니다. Play에 새 빌드를 제출하기 전에는 기존에 사용한 모든 코드보다 큰 `versionCode`로 올려야 합니다. 이 워크플로는 Play의 현재 버전을 조회하거나 자동으로 변경하지 않습니다.

## 서명 설정

저장소의 **Settings → Secrets and variables → Actions**에 다음 다섯 secret을 **모두** 설정하면 기존 업로드 키로 서명합니다. 새 키를 생성하거나 기존 키를 교체하지 않습니다.

| Secret | 값 |
| --- | --- |
| `PUSH_OFFICE_KEYSTORE_BASE64` | 기존 업로드 keystore 파일을 base64로 인코딩한 값 |
| `PUSH_OFFICE_KEYSTORE_PASSWORD` | 기존 keystore 비밀번호 |
| `PUSH_OFFICE_KEY_ALIAS` | 기존 업로드 키 alias |
| `PUSH_OFFICE_KEY_PASSWORD` | 기존 키 비밀번호 |
| `PUSH_OFFICE_UPLOAD_CERT_SHA256` | Play Console의 앱 무결성 화면에 표시된 **업로드 키 인증서** SHA-256. 콜론 포함/미포함 모두 허용 |

2026-11-03에 확인한 기존 Play 앱의 공개 업로드 인증서 SHA-256은 `AE:10:E3:7E:FA:71:64:1A:54:49:0F:0A:24:95:77:3D:41:E9:13:18:51:52:DF:32:4B:63:77:6A:6F:A2:F5:91`입니다. 앱 서명 키 인증서와 구별해야 하며, Play에서 업로드 키를 정식 변경한 경우에는 그 새 값을 사용합니다.

다섯 개가 모두 없으면 `...-unsigned.aab`만 생성합니다. 이 파일은 서명 준비용이며 Play에 업로드하면 안 됩니다. 일부만 설정한 경우에는 실패하고 artifact를 게시하지 않습니다.

keystore 인증서가 지정한 SHA-256과 일치하지 않거나 Android Debug 인증서이면 서명을 거부합니다. keystore는 runner의 비공개 임시 디렉터리에서만 복원되고 작업 종료 시 삭제됩니다. 비밀번호는 JDK 명령의 환경 변수 참조로 전달하며 키·비밀번호·alias·인증서 값은 로그에 출력하지 않습니다. 서명 secret은 마지막 검증/서명 단계에만 제공됩니다.

## 결과와 검증

Actions artifact에는 검증을 마친 AAB 하나, SHA-256 파일, JSON 검증 보고서가 들어갑니다. 이름에 `signed` 또는 `unsigned`가 표시됩니다. Gradle이 임시 결과에 붙인 debug 서명은 제거한 뒤 후속 작업을 수행하므로 debug 서명 파일을 release artifact로 게시하지 않습니다.

검증 항목은 ZIP 무결성, 보존한 엔트리의 바이트/메타데이터, 기존 앱 패키지, `app.json` 버전, SDK 26/36, debuggable 여부, 차단 권한, ARM64·ARMv7·x86_64, 64비트 네이티브 라이브러리의 16 KB 페이지 정렬입니다. Gradle이 받은 bundletool로 구조를 추가 검증합니다. 서명 모드에서는 jarsigner 무결성 검사와 최종 업로드 인증서 일치를 재검사합니다.

현재 서명 제거 도구는 ZIP32 AAB를 지원하며 ZIP64나 중복 엔트리는 실패 처리합니다. 업로드 키는 단일 leaf 인증서의 SHA-256으로 확인합니다. **Play API 업로드, 트랙 배포, GitHub Release 공개는 수행하지 않습니다.** signed 결과도 별도로 검토한 후 기존 Play 앱에 제출해야 합니다.

스크립트 테스트:

```sh
python3 -m unittest discover -s tools/ci -p 'test_*.py'
```

빌드가 끝난 로컬 환경에서도 다음 명령을 사용할 수 있습니다. Java 17의 `java`, `keytool`, `jarsigner`와 해당 빌드의 Gradle 의존성 캐시가 필요합니다.

```sh
python3 tools/ci/release_aab.py \
  --source android/app/build/outputs/bundle/release/app-release.aab \
  --output-directory /tmp/push-office-artifacts
```

secret 값을 명령줄에 넣거나 `set -x`, 환경 변수 전체 출력, keystore 내용 출력으로 확인하지 마세요.

## Windows에서 기존 키 내려받기

Expo 대시보드의 기존 `hebi96 / pushOffice_app` 프로젝트와 Android 앱 항목 `com.hebi96.pushOffice_app`을 사용합니다. 연결된 기존 EAS projectId는 `0e5da6f1-57cb-4cf6-9d24-5a65efee7575`입니다. 프로젝트나 키를 새로 생성하는 단계는 없습니다.

웹 내보내기의 완료 여부를 확인할 수 없는 경우, Windows PowerShell에서 다음 명령을 실행합니다. 올바른 저장소를 별도 임시 폴더에 내려받아 기존 로컬 프로젝트 선택 오류를 피합니다. Node.js/npm 및 Git이 설치된 PC가 필요합니다.

```powershell
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$workPath = Join-Path $env:TEMP ("PushOffice-key-" + [guid]::NewGuid().ToString("N"))
git clone --depth 1 https://github.com/hebi10/pushOffice_app.git $workPath
if ($LASTEXITCODE -ne 0) { throw "Project download failed." }
Set-Location $workPath
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npx.cmd --yes eas-cli@latest login --browser
npx.cmd --yes eas-cli@latest credentials --platform android
```

브라우저 로그인은 기존 `hebi96` 계정을 사용합니다. 이어서 터미널 메뉴에서 다음 항목을 선택합니다.

```text
production
credentials.json: Upload/Download credentials between EAS servers and your local json
Download credentials from EAS to credentials.json
```

다운로드한 `credentials.json`의 `android.keystore`에는 keystore 파일 경로와 keystorePassword/keyAlias/keyPassword가 들어 있습니다. GitHub의 네 가지 비밀값을 채울 때 사용합니다. 이 파일과 키 파일을 채팅이나 공개 소스로 보내지 않습니다. 이 저장소는 다운로드한 자격 증명 JSON과 keystore 파일을 Git 추적에서 제외합니다.

등록할 비밀값의 이름은 다음과 같습니다. 값은 파일과 PC의 클립보드에서 GitHub 입력칸으로만 옮깁니다.

```text
PUSH_OFFICE_KEYSTORE_BASE64
PUSH_OFFICE_KEYSTORE_PASSWORD
PUSH_OFFICE_KEY_ALIAS
PUSH_OFFICE_KEY_PASSWORD
```

2026-11-04 확인 시 공개 인증서 검사값 `PUSH_OFFICE_UPLOAD_CERT_SHA256`만 GitHub에 등록했습니다. 기존 키와의 실제 일치는 아직 확인하지 못했으며, 네 비밀값 등록 후 CI의 인증서 검사에서 확인합니다. 모든 비밀값을 등록하기 전에는 release workflow를 실행하지 않습니다.

공식 절차: https://docs.expo.dev/app-signing/syncing-credentials/
