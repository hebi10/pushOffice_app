# Push Office Play 등록 준비물

기준: 2026-11-03 / 패키지 com.hebi96.pushOffice_app / 버전 1.1.0 / 버전 코드 3

## 저장된 내용

Play Console 기본 등록정보에 앱 이름·간단한 설명·상세 설명·아이콘·배너·휴대전화 스크린샷 6장을 저장했습니다. 지원 이메일·공개 개인정보처리방침 URL과 데이터 보안 최종 답변도 저장했습니다. 대시보드에서 등록 작업 **10/11 완료**를 확인하고 캡처를 보존했습니다. 남은 등록 항목은 콘텐츠 등급(IARC 약관 미체크)입니다. 앱 검토 전송과 정식 출시는 하지 않았습니다.

앱 이름: Push Office - 일정과 브리핑
카테고리: 생산성. 공개 지원 이메일: asdlkj0104@gmail.com. 연락처 저장·게시가 완료되었습니다.
광고 없음, 로그인 불필요, 정부 앱 아님, 건강 기능 없음, 성인 대상(18세 이상)을 저장했습니다. 금융 기능은 선택적 공개 주가 표시를 기타로 설명했습니다.
내부 테스트 새 임시 출시(출시명 1.1.0 · 로컬 일정 비서)에 한국어 출시 노트를 저장했습니다. 기존 활성 버전은 1.0.1(코드 2)이며 새 AAB는 업로드하지 않았습니다.
데이터 보안은 최종 저장했으며 검토로 전송하지 않았습니다. 이번 GitHub Actions 빌드는 `EXPO_NO_DOTENV=1`이고 외부 브리핑·Firebase 환경값을 주입하지 않는 범위입니다. ML Kit의 기기 또는 기타 ID·진단에 대해 수집, 공유 안 함, 임시 처리 아님, 필수, 분석 목적을 저장했습니다. 전송 암호화는 예, 새 계정 생성·외부 로그인은 아니요입니다. 삭제 요청 배지는 아니요로 저장했습니다. 이메일 문의 경로가 있어도 운영자가 Google SDK 진단의 삭제를 보장하는 경로를 갖춘 것으로 표시하지 않았습니다.

공개 정책: https://hebi10.github.io/pushOffice_app/privacy/ . 공개 브라우저 접근과 Console URL 저장이 확인되었습니다. 운영 주체는 GitHub hebi10의 Push Office 운영자입니다. GitHub main 게시 커밋: https://github.com/hebi10/pushOffice_app/commit/27cec8350052133916dd98978a280d40cc0fffd0 .

## 파일

ko-KR/app-icon.png: 512×512 스토어 아이콘
ko-KR/feature-graphic.png: 1024×500 배너
ko-KR/screenshots/: 1080×1920 실제 앱 캡처 기반 이미지 6장
privacy-policy-draft.ko.html: 파일명은 이전 호환용으로 유지한 **최종 개인정보처리방침** 복사본입니다. 공개 원본 docs/privacy/index.html과 내용이 같습니다. 초안 표시나 미입력 연락처가 없습니다.
data-safety-evidence.md: 실제 저장한 데이터 보안 답변, 이번 CI 빌드 범위와 선택 기능의 근거
release-notes-ko-KR.txt: 내부 테스트 출시 노트

## 서명 및 남은 입력

GitHub Actions 실행 [41588844929](https://github.com/hebi10/pushOffice_app/actions/runs/41588844929)가 전체 성공했습니다. EAS 없이 Gradle 빌드(19분 18초), 미서명 AAB 검증과 artifact 게시까지 통과했습니다. [결과 파일](https://github.com/hebi10/pushOffice_app/actions/runs/41588844929/artifacts/13209608492)의 AAB는 62,295,369바이트, SHA-256 `244f71614e52014bc39bc160c045c52a9c2e8f7c9e46dd4d1c29a0af96a8f903`입니다. 기존 로컬 62,345,073바이트 준비본은 이전 참고 자료입니다.

원래 업로드 키를 확보하고 Play Console 인증서와 일치하는지 확인한 뒤 해당 키로 서명해야 합니다. 새 AAB는 아직 업로드하지 않았고 IARC 약관도 체크하지 않았습니다. 디버그 키로 서명한 파일과 미서명 참고본을 출시 파일로 사용하지 않습니다.

외부 브리핑·Firebase를 나중에 활성화하면 실제 서버의 전송·보관·삭제 및 데이터 보안 답변을 다시 확인해야 합니다. 브라우저 직접 파일 첨부는 빈 파일로 처리되어 스토어 이미지는 Drive 가져오기로 등록했습니다. 최종 ZIP 갱신은 별도 작업입니다.
