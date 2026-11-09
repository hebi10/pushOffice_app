# Push Office — Android 에뮬레이터 5종 AI 모델 실행 가능성 검증

대상: PR #45 (병합·Google Play 배포 전).

## 검증 구분

- **Android API 35 x86_64 Google APIs 에뮬레이터**의 실제 앱 모듈에서 Gemini Nano/AICore의 `checkStatus()`를 호출하고, 공개 4개 LiteRT-LM 모델의 설치 상태·추론 진입 오류 처리를 검사합니다.
- Android에서 실제 SHA-256 128KB 파일과 1바이트 변조 검사, `java.time` 일정 시각 계산을 검증합니다.
- 빌드 APK 내 LiteRT 네이티브 라이브러리의 ABI를 별도 수집합니다.
- 설치된 실제 모델 파일의 SHA-256이 확인된 경우에만 `AiModelRunner.benchmark`로 실제 추론을 수행합니다. **설치되지 않은 모델의 오류 처리 성공은 추론 성공이 아닙니다.**
- `five-model-probe.json`의 `inference: passed`만 실제 Android 추론 성공이며, `not_executed`는 검증 미완료입니다.
- 이전 Linux CPU 4개 모델 전체 파일 다운로드·추론 증빙: GitHub Actions #42565764421. 이는 Android 추론 증빙으로 대체할 수 없습니다.

## 한계 및 다음 조건

- 일반 GitHub-hosted x86_64 에뮬레이터에는 제조사별 AICore/Gemini Nano를 제공하는 보장이 없습니다. AICore가 미지원이면 `not_executed` 기록으로 남깁니다.
- LiteRT-LM 아티팩트의 해당 에뮬레이터 ABI용 JNI가 없거나 메모리/스토리지가 부족하면 실제 모델 추론 성공 판정이 불가능합니다.
- **전체 5종 모델의 Android 실추론 성공을 주장하려면** 실제 지원 Android 기기(대용량 모델은 충분한 RAM·저장 공간 필요)에서 각각 파일 다운로드·해시·Korean 일정 출력·실행 시간까지 검증해야 합니다.
- 테스트는 어떤 일정을 저장하거나 클라우드 모델로 대체하지 않습니다. 테스트 코드는 `androidTest` 범위로만 배포되며 일반 APK에 포함되지 않습니다.
- Android/모델 실추론 승인 전 PR Draft 유지, `main` 병합·Google Play 비공개 배포 진행 금지.
