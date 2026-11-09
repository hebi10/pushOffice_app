# Android 에뮬레이터 — 공개 LiteRT-LM 4종 실제 모델 파일 추론

PR #45의 이전 Android API 35 CI #42570423603에서 APK의 x86_64용 `liblitertlm_jni.so`와 실제 Android 테스트 기동을 확인했습니다. 기존 1차 테스트의 모델 추론은 0/5로, 4개 실제 파일이 설치되지 않아 실행하지 못했습니다.

## 신규 실제 실행 테스트

- 모델별 GitHub Actions matrix: Qwen3 0.6B, Qwen3.5 0.8B/2B, Gemma 4 E2B.
- Hugging Face 공식 아티팩트를 **전체 다운로드**, SHA256·파일 크기를 서버의 고정값과 비교.
- Android 35 x86_64 에뮬레이터의 앱 전용 파일 경로로 `adb push` (APK에 파일 번들 금지).
- Android에서 다시 파일 전체 SHA256 검증. `AiModelRunner.infer` 실제 CPU 텍스트 추론 후 한국어 일정 추출 비교.
- `sha256VerifiedOnAndroid`, `actualCpuTextGenerated`, `koreanSchedulePassed`를 **서로 다른 결과**로 저장. 한국어 정확도 실패는 실제 텍스트 생성 성공을 무효화하지 않으며 QA 보완 과제로 기록.
- ARM64 실기기보다 느리거나 메모리/저장공간 제한으로 실패할 수 있음. CI 실패를 실기기에서도 불가능하다는 근거로 일반화하지 않음.
- Gemma/Qwen 대형 모델은 RAM과 저장공간 제약이 커서 에뮬레이터에서 추론 실패할 수 있습니다. 실패 시 로그/아티팩트를 보존합니다.
- Gemini Nano는 AICore 시스템 기능으로 해당 에뮬레이터에서 `unavailable` 확인. **Gemini Nano 추론은 지원 물리 기기에서 별도 검증 필요**.
- 결과 확인 후에도 일반 Play 배포는 하지 않습니다.
