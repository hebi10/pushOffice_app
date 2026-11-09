# Push Office — 기기 AI 모델 관리: 5개 모델 비교·설치·테스트·선택

작성: 2026-11-09 / 기존 PR #44(Gemini Nano 다운로드 진단·수동 재시도) 기반의 후속 기능. 기존 1차 테스트 v1.1.0(17)은 변경하지 않습니다.

## 구현 영역
- 설정 > 기기 내 음성과 AI > 기기 AI 모델 관리.
- 5개 모델: Gemini Nano(AICore), Qwen3 0.6B, Qwen3.5 0.8B, Qwen3.5 2B, Gemma 4 E2B (LiteRT-LM).
- 모델별 엔진, 대략적 파일 용량, 라이선스, 사용 가능한 상태, 실제 다운로드 상태, 공식 출처 표시.
- 사용자 직접 다운로드: Android DownloadManager, Wi-Fi/비로밍만 허용, 앱 전용 외부 파일 경로, 300MB 추가 여유 공간, HF 제공 원격 SHA256/크기 메타데이터 및 완료 후 로컬 SHA256 검사, 미완료/오류 파일은 사용 불가.
- 앱 복귀 시 다운로드 진행/완료 확인, 중단·삭제 시 진행 요청 취소 및 모델 제거, 삭제된 선택 모델은 Gemini Nano로 복귀.
- 사용자가 편집한 동일한 한국어 일정 문장으로 설치 모델을 한 번씩 테스트. 실제 제목·시각·반복·응답 시간을 표시하며 일정은 절대 저장하지 않음.
- 앱 내 기본 모델 선택: 테스트 성공 후에만 UI에서 선택 가능. 선택은 앱 내부 설정으로 유지. 기존 빠른 입력·알림 후보 AI 재분석·로컬 브리핑이 선택된 엔진을 사용.
- LiteRT-LM 0.19.1 CPU 경로. 큰 모델은 현재 여유 RAM이 부족하면 실행하지 않고 사용자에게 표시. 파일은 APK/AAB에 포함하지 않음.

## 주요 경계
- AICore의 Gemini Nano 모델 파일은 시스템 관리이므로 직접 삭제/복사하지 않습니다.
- 로컬 모델은 공개 HF LiteRT Community의 승인된 URL만 사용하며, 모델 메타데이터 SHA256이 없으면 다운로드를 차단합니다.
- Qwen3.5 모델은 repo/파일 제공자가 버전을 갱신할 수 있으므로 원격 파일 무결성 정보와 크기를 다운로드 시작 시 조회하고 완료 후 다시 대조합니다. SHA 미확인 상태를 "설치 완료"로 표시하지 않습니다.
- 동적 `DownloadManager` 진행률은 파일 바이트 수 기준이며, 추론 정확도/속도를 사전 수치로 꾸며내지 않습니다. Gemini Nano와 LiteRT-LM이 실제 기기에서 각각 정상 실행돼야 비교 가능.
- 모델 테스트만으로 일정이 자동 저장되지 않고, 실제 일정 추가는 기존 편집·확인·저장 단계를 유지합니다.
- 알림 본문은 외부 전송하지 않음. AI 추론은 사용자가 앱을 열어 요청할 때만 실행.
- 기존 서명 키, 버전 코드, Google Play 비공개 테스트 트랙 및 스토어 이미지는 불변.

## 실제 QA 단계
1. Node 전체 회귀 + 기존 테마/기능 UI 자동 검사.
2. Kotlin JUnit Catalog 검사, Android Debug/Release 빌드.
3. Android 29 에뮬레이터에서 메뉴 및 로컬 UI 확인 (실제 모델 대용량 다운로드는 테스트 환경에서 실행하지 않음).
4. Gemini Nano 지원 기기에서 다운로드·테스트·선택, Qwen3 0.6B와 0.8B 실물 다운로드·SHA 검증·추론·삭제, 2B/Gemma 실제 RAM과 시간 확인.
5. Wi-Fi 끊김·저장 공간 부족·중복 누름·재실행 복구·모델 파일 손상·원격 파일 변경 등 부정 테스트.
6. 실제 지원 기기 벤치마크/QA 통과 후에만 PR 병합 및 Play 비공개 트랙 배포 검토.

## 공식 근거
- LiteRT-LM Android API https://developers.google.com/edge/litert-lm/android
- Qwen3 0.6B https://huggingface.co/litert-community/Qwen3-0.6B
- Qwen3.5 0.8B https://huggingface.co/litert-community/Qwen3.5-0.8B
- Qwen3.5 2B https://huggingface.co/litert-community/Qwen3.5-2B
- Gemma 4 E2B https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm
- Gemini Nano https://developers.google.com/ml-kit/genai/prompt/android/get-started

## CI 수정: LiteRT-LM 0.19.1 응답 타입
- 첫 CI #42557171118에서 `AiModelRunner.kt`의 `conversation.sendMessage(prompt).text`가 Kotlin 미지원 속성으로 컴파일 실패.
- 공식 Android API의 `Message.toString()` 이용 방식으로 변환하고 새 커밋 재검증.
- 실패한 CI는 완료 성공으로 판단하지 않음.

## Android 실화면 캡처 추가
- 기존 57장 캡처 매트릭스를 유지하면서 AI 모델 관리 화면 1장을 추가.
- `pushofficeapp://ai-models` 실제 Android 딥링크로 화면을 열고 `기기 AI 모델 비교` 텍스트 노출을 확인한 다음 PNG 저장.
- UI 캡처 검증에서 `19a-ai-model-manager.png`를 필수로 지정.

## 2026-11-09 실제 캡처 QA 보정
- 첫 Android API29 실캡처 58장(경고 0)을 확인한 결과, AICore 미지원 에뮬레이터에서도 기본 모델의 '사용 중' 배지가 출력됨.
- 실제 모델이 `available` / `installed`일 때만 '기본 모델' 배지를 보여 실제 사용 가능 상태와 선택값을 혼동하지 않도록 수정.
- 5종 전체 렌더링을 증명하도록 관리 화면 하단 스크롤 후 `Gemma 4 E2B` 접근성 문구 확인 및 19b 캡처 추가.
- 수정본의 최신 59장 캡처 및 CI 통과가 확인돼야 QA 성공 처리.

## 2026-11-09 실파일 다운로드 보강
- 실제 Hugging Face HEAD 파일 크기/sha: Qwen3 0.6B 613,722,264 B · `c5f39b4...`, Qwen3.5 0.8B 964,657,152 B · `d6702088...`, Qwen3.5 2B 2,119,843,840 B · `c2438cb9...`, Gemma 4 E2B 2,588,147,712 B · `18193810...` 확인. 모두 현재 SHA를 앱 카탈로그에 고정.
- 실제 Qwen3 0.6B 파일 다운로드·전체 SHA 일치 및 Linux CPU 실제 추론 성공. GitHub Actions에서 다른 3개 모델의 실파일 다운로드·해시·CPU 추론 시험 진행.
- 앱 모델 선택 및 추론 직전에 전체 파일 SHA 재검사, 실패하면 안전하게 차단·다시 다운로드 요청. 설치된 모델용 '파일 SHA-256 무결성 검사' 버튼 추가. JUnit에서 정상/손상/크기 오류 검증.
- Linux GitHub runner에서 성공한 추론은 **Android 물리 기기 추론 성공을 의미하지 않음**.

## 실제 한국어 일정 정확도 QA 및 수정
- 실파일 SHA·Linux CPU 텍스트 추론은 Qwen3 0.6B, Qwen3.5 0.8B·2B, Gemma 4 E2B 4종 모두 통과.
- 동일한 2026-11-17 15:00(KST) 한국어 일정 입력에서 모델 4개가 epoch 밀리초를 잘못 계산. 정확도 0/4(원래 프롬프트). 이를 모델의 추론 성공으로 둔갑시키지 않음.
- 기존 원시 숫자 신뢰 방식을 중단. 모델은 YYYY-MM-DD, HH:mm, repeatType만 반환하고 실제 시각 계산은 `java.time` 담당.
- 원문이 로컬 ScheduleParser로 확정되는 경우 모델이 제안한 날짜·시간·반복이 불일치하면 명확히 실패 처리. AI 결과로 잘못된 미래 일정 생성 방지.
- Gemini Nano도 동일한 안전한 로컬 시각 계산 경로를 사용, 날짜 정합성 회귀 테스트 추가.
- 개선된 프롬프트로 4개 실제 모델을 다시 실행하는 실파일 CI 별도 검사 추가.
