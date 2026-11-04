# Push Office 자동 빌드·테스트 배포

`Actions → Push Office Play release`에서 실행 상태와 결과 파일을 확인합니다. Expo EAS 로그인 없이 GitHub의 Ubuntu runner에서 Node 22·Java 17·Gradle로 빌드합니다. 앱 소스와 UI는 변경하지 않습니다.

## 실행 방식

| 실행 | 결과 |
| --- | --- |
| `main`의 앱·빌드 관련 파일 변경 | APK/AAB 빌드 → 서명 검증 → 내부 테스트 배포 |
| 수동 `mode=deploy`, `target=internal` | 내부 테스트 배포. 기본 선택값 |
| 수동 `mode=deploy`, `target=closed` | 지정한 기존 비공개 테스트 트랙에 배포 |
| 수동 `mode=build` | 서명된 APK/AAB만 생성. Play 인증·업로드 없음 |
| 수동 `mode=check` | Play 계정·트랙·버전 조회만 수행. 빌드·업로드 없음 |

수동 실행도 `main`을 선택합니다. 비공개 테스트는 `closed_track` 입력 또는 저장소 변수 `PLAY_CLOSED_TRACK`에 **실제 기존 API 트랙 ID**가 있어야 합니다. 빈 값에 임의 트랙을 대입하거나 트랙을 새로 만들지 않습니다. 프로덕션·공개 테스트 배포는 지원하지 않습니다.

내부 트랙은 실제 API 목록의 `qa` 또는 `internal` 중 하나를 확인해 선택합니다. 비공개 입력에는 `production`, `beta`, `qa`, `internal`과 폼 팩터 트랙을 허용하지 않습니다.

## 기존 Google 인증

프로젝트 `Hebi App Release` (`hebi-app-release-80847404`, 번호 `973619009476`)의 기존 앱 전용 계정을 재사용합니다. 새로운 서비스 계정·JSON 비밀키를 만들지 않습니다.

| 저장소 변수 | 값 |
| --- | --- |
| `PLAY_WORKLOAD_IDENTITY_PROVIDER` | `projects/973619009476/locations/global/workloadIdentityPools/github/providers/github` |
| `PLAY_SERVICE_ACCOUNT` | `play-pushoffice@hebi-app-release-80847404.iam.gserviceaccount.com` |

이 서비스 계정은 Push Office 앱에만 정보 조회·테스트 트랙 출시 권한을 갖습니다. GitHub OIDC로 단기 OAuth 토큰을 발급하며 scope는 `androidpublisher`입니다. 빌드 후 새 토큰을 받아 만료된 빌드 전 토큰으로 업로드하지 않습니다.

## 업로드 서명키

기존에 확보한 keystore와 비밀번호·alias를 아래 네 저장소 Secret에 등록합니다. 값은 로그·공개 소스·일반 결과 파일에 넣지 않습니다.

```text
PUSH_OFFICE_KEYSTORE_BASE64
PUSH_OFFICE_KEYSTORE_PASSWORD
PUSH_OFFICE_KEY_ALIAS
PUSH_OFFICE_KEY_PASSWORD
```

승인된 업로드 인증서 SHA-256은 다음 공개 값이며 워크플로와 검증 코드에 고정했습니다. 이전 `PUSH_OFFICE_UPLOAD_CERT_SHA256` Secret은 현재 워크플로에서 사용하지 않습니다.

```text
7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845
```

2026-11-04에 키 복구와 Play 업로드 키 재설정 접수가 완료됐습니다. 새 키 유효 시각은 **2026-11-06 12:32 KST**입니다. 같은 이유로 키를 다시 생성하거나 재설정 요청을 반복하지 않습니다. 활성화 전에는 빌드·서명 파일을 보관하고 업로드 단계는 `deferred`로 표시합니다. 예약 작업을 새로 만들거나 성공한 Play 출시로 표시하지 않습니다.

Secret이 하나라도 빠졌으면 빌드 전에 실패합니다. 서명 없는 파일이나 debug 서명 APK를 배포 결과로 사용하지 않습니다. keystore는 서명 단계의 비공개 임시 디렉터리에서만 복원하고 삭제합니다. 비밀번호는 JDK/apksigner의 환경 변수 참조로 전달합니다.

## 버전·업로드 검증

모든 실행은 앱 단위 concurrency 그룹으로 직렬 처리합니다. Play의 모든 APK·AAB·트랙 코드와 원본 `app.json` 코드를 조회해 새 코드를 정하고, 일회성 체크아웃의 `app.json`에만 반영한 뒤 Expo prebuild를 실행합니다. 저장소에 버전 수정 커밋을 자동 생성하지 않습니다. 빌드 전용 모드는 원본 코드에 GitHub run number를 더하며 이 번호로 Play 배포를 보장하지 않습니다.

업로드 직전에 기존 코드를 다시 조회해 외부 업로드로 생긴 충돌을 거부합니다. 선택한 트랙의 완료된 출시 또는 버전 코드 없는 빈 초안만 대체합니다. 내용이 있는 초안·진행 중 출시·중단 출시는 Console에서 먼저 해결해야 합니다. 다른 트랙은 수정하지 않습니다.

AAB는 패키지 `com.hebi96.pushOffice_app`, SDK 26/36, 버전, debuggable=false, 차단 권한, ARM64·ARMv7·x86_64, 64비트 ELF 16KB 정렬, bundletool 구조, 실제 서명과 인증서 지문을 검증합니다. 검증 보고서의 hash·크기·실제 AAB 내용을 업로드 전에 다시 대조합니다. 보고서의 출처 커밋은 현재 실행의 `GITHUB_SHA`와 정확히 같아야 하며, 패키지·버전명·버전 코드는 해당 빌드에 사용한 일회성 `app.json`과 일치해야 합니다. 출처가 없거나 이전 빌드의 파일이면 Play API 요청 전에 중단합니다. APK도 v2 단일 서명, 16KB ZIP/ELF 정렬과 서명 전후 payload 일치를 확인합니다.

업로드 응답의 버전·SHA-256 확인 → 트랙 갱신 → edit 검증 → 기존 검토가 있으면 중단하는 `ERROR_IF_IN_REVIEW` commit → 새 edit에서 최종 트랙 확인 순서입니다. 업로드·commit 결과가 불명확하면 자동 재시도하지 않습니다. API가 접수한 것과 Google 검토 승인·테스터에게 제공된 것은 별도입니다.

## 결과 파일

Actions artifact의 `aab/`, `apk/`에는 서명된 파일·SHA-256·검증 JSON이 들어갑니다. 조회·배포 결과 JSON도 함께 보관합니다. 보관 기간은 30일입니다. Play에는 AAB만 업로드합니다.

APK는 업로드 키로 서명하므로 기존 Play 설치본을 업데이트할 수 없습니다. 기존 앱을 삭제하면 로컬 일정이 삭제되므로 기존 사용자는 Play 내부 테스트 업데이트를 이용합니다.

```sh
python3 -m unittest discover -s tools/ci -p 'test_*.py'
```

릴리스 도구 또는 워크플로를 수정한 PR에서는 `Push Office release tool checks`가 비밀 설정이나 Play 인증 없이 이 검증을 실행합니다.

공식 문서:
- https://developers.google.com/android-publisher/tracks
- https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit
- https://github.com/google-github-actions/auth
