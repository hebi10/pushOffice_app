# AI-01-B — Gemini Nano 및 ARM64 물리 기기 QA

이 문서는 물리 기기 테스트 절차 및 승인 게이트입니다. 통과 보고서가 아닙니다.

## 대상과 사전 조건
- Galaxy Z Fold8 등 ML Kit GenAI Prompt API 지원 장치. Google 기기 지원 목록: https://developers.google.com/ml-kit/genai
- 앱: PR #45의 동일 커밋으로 빌드한 APK. 기존 Play 테스트 앱에는 신규 모델 관리 기능이 없을 수 있습니다.
- USB 디버깅 허용된 실제 ARM64 단말, Wi-Fi, 충분한 저장 공간, 배터리와 기기 열 안정 상태.
- 실제 캘린더·알림 데이터는 사용하지 않고 고정 테스트 문장만 사용. 개인 데이터나 기기 일련번호 수집 금지.

## Gemini Nano / AICore
1. 설정 > 기기 내 음성과 AI > 기기 AI 모델 관리에서 Gemini Nano 상태 확인.
2. available/downloadable/downloading/unavailable/error 중 실제 반환값을 기록. 미지원은 성공이 아님.
3. 다운로드 가능한 상태라면 사용자가 직접 다운로드 요청. 완료 후 available 재확인. 시스템 관리 모델 파일을 직접 변경하거나 삭제하지 않음.
4. 동일한 합성 문장 '2026년 11월 17일 오후 3시에 치과 예약'으로 모델 테스트.
5. 예상: 제목 치과 예약, 2026-11-17, 15:00, repeatType none. 실제 시간과 오류 코드를 기록.
6. 일정이 자동 저장되지 않음, 앱 재시작 시 상태·선택 유지 확인.
7. AICore 초기화·권한·할당량·백그라운드 제한은 실패 종류별로 기록하고 무한 재시도 금지.

## 네 가지 LiteRT-LM 모델: ARM64
- Qwen3 0.6B, Qwen3.5 0.8B, Qwen3.5 2B, Gemma 4 E2B를 개별 검증.
- Wi-Fi 사용자 직접 다운로드 → 고정 파일 크기와 전체 SHA-256 검사 → 한국어 일정 추론 → 결과·시간 기록.
- 앱 재시작 후 파일 유지, 해시 재검증, 저장된 일정 자동 변경 없음 확인.
- 저장 공간 부족, Wi-Fi 끊김, 다운로드 취소/재시도, 데이터 손상·삭제, RAM 부족 시 안전한 실패 확인.
- CPU 추론 지연, 메모리 부족, 발열, 앱 강제 종료 여부 기록. 한 번의 실행으로 성능 우열 단정 금지.

## Windows 환경 수집
PowerShell에서 다음 명령을 실행합니다.

    powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\qa\collect-android-ai-physical.ps1

해당 도구는 adb로 Android SDK, CPU ABI, RAM, 저장 공간 등 기기 환경만 수집하고 모델 관리 화면을 엽니다. 실제 AI 다운로드·추론을 실행하거나 개인 데이터를 업로드하지 않습니다. 결과는 로컬 android-ai-physical-qa 폴더의 JSON에 저장됩니다.

## 승인 게이트
- Gemini Nano: AICore available + 실제 한국어 추론 정합성 + 앱 재실행 정상.
- LiteRT 4종: ARM64 기기 다운로드·전체 SHA256·실추론·실패복구·메모리 및 성능 QA.
- 자동 일정 저장 금지, 손상 모델 실행 차단, 민감 정보 외부 전송 금지.
- 미실행이나 실패를 통과 처리하지 않음. 전 항목 검증 전 PR #45 Draft, main 병합·신규 Play 배포 보류.

## 기존 검증과 한계
- 4종 Android API35 x86_64 실파일 SHA 및 CPU 추론: https://github.com/hebi10/pushOffice_app/actions/runs/42582438700
- GitHub 에뮬레이터는 물리 ARM64/Gemini Nano 실행 결과를 대신하지 않음.