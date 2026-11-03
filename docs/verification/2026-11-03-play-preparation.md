# Play 등록 준비 검증

버전 1.1.0(3), com.hebi96.pushOffice_app. 기존 Console 코드 2를 직접 확인한 뒤 새 코드를 선택했다.

- 생성 기능으로 만든 원본 아이콘을 보존하고 Android adaptive·monochrome·splash·favicon과 스토어 512px 아이콘·1024×500 배너를 내보냈다. 실제 캡처 6장을 전체 화면 비율을 유지한 1080×1920 레이아웃으로 정리했다.
- 카메라·외부 저장소 읽기/쓰기·다른 앱 위 표시 권한 4개를 app.json blockedPermissions로 제거했다. 새 AAB manifest에서도 모두 없는 것을 확인했다.
- TypeScript, 앱 범위 ESLint, Node 회귀 검사 50개, 공백 검사를 통과했다. 소프트웨어 실행 코드 변경 없이 아이콘·권한·버전 설정과 등록 자료를 반영했다.
- Gradle bundleRelease가 20분 21초, 작업 784개로 성공했다. bundletool/ZIP 검사, package/version/min26/target36, 세 ABI별 라이브러리 23개, 모든 ARM64 ELF의 16KB 정렬 및 BundleConfig PAGE_ALIGNMENT_16K를 확인했다.
- 생성된 원래 AAB에는 Android Debug 서명이 남아 있었다. 원본을 보존하고 별도 준비본에서 JAR 서명 항목 3개만 제거했다. 나머지 1,457개 항목의 이름·페이로드·메타데이터·로컬 ZIP 레코드가 동일하고 새 ZIP/bundletool 검사와 미서명 확인이 통과했다.
- 미서명 준비본 SHA-256: 9bd3019f930894be116c8d4636d722034618093432a1e10025f60ab2a46f6ec4. 크기 62,345,073바이트. 원래 업로드 키의 서명·인증서 대조 전에는 업로드하지 않는다.
- Play 기본 등록정보 전체 시각·문자 애셋을 저장했고 생산성 카테고리를 선택했다. 초기 확인 시 7/11 설정이었고, 이후 대시보드에서 **10/11 완료**를 직접 확인하여 캡처를 보존했다. 사용자 승인으로 마지막 콘텐츠 등급의 IARC 약관 체크·설문·요약 저장을 완료했으므로 **11/11 완료는 이전 관찰값에 마지막 완료를 더한 도출값**이다. 새 UI에서 11/11 숫자를 직접 관찰한 것은 아니다. 마지막 저장 뒤 앱 설정 카드가 사라지고 비공개 테스트 단계가 활성화되었다. 공개 지원 이메일 asdlkj0104@gmail.com은 저장·게시했다. 내부 테스트 임시 출시 4에 제목·한국어 노트를 저장했다. Console은 검토 전송 준비 상태이며 새 AAB 업로드 및 검토 전송·출시는 하지 않았다.
- 데이터 보안은 최종 저장 완료이며 검토 미전송이다. 이번 CI는 `EXPO_NO_DOTENV=1`, 외부 백엔드·Firebase 환경값 미주입 범위다. ML Kit 기기 또는 기타 ID·진단에 대해 수집·공유 안 함·임시 처리 아님·필수·분석 목적을 저장했다. 전송 암호화 예, 새 계정 생성·외부 로그인 아니요도 저장했다. 이메일 수동 문의 경로와 Google SDK 진단 삭제 보장을 구별하여 삭제 요청 배지는 아니요로 저장했다.
- 개인정보처리방침은 [공개 페이지](https://hebi10.github.io/pushOffice_app/privacy/)에서 로그인 없는 브라우저 접근을 확인하고 Console URL을 저장했다. 운영 주체는 GitHub hebi10의 Push Office 운영자이며 제공된 지원 이메일을 반영했다. 공개 원본은 docs/privacy/index.html, store-assets/privacy-policy-draft.ko.html은 같은 최종본의 복사본이다. 과거의 IARC 승인 대기·약관 미체크 상태는 사용자 승인 후 약관 체크·설문·요약 저장 완료로 바뀌었다.
- 콘텐츠 등급 결과: 한국 3+, Generic 3+, ESRB Everyone, PEGI 3, USK 전체 연령, ClassInd 전체 연령, 러시아 3+. 온라인 콘텐츠는 기기 AI 생성 요약을 포함하여 예로 저장했다. 패키지 내 등급 대상 콘텐츠·UGC 공유·폭력·선정성·욕설·약물·연령 제한 판매·위치 공유·구매·현금 보상·브라우저·주요 뉴스·교육은 아니요로 저장했다.
- content-rating-overview 화면에서 IARC 상태 ‘완료됨’, 제출 시각 `2026-11-03 15:54 KST`, 대한민국 3+를 직접 확인했다. 완료 증거는 `/workspace/scratch/a7f1e63aed56/deliverables/PushOffice-IARC-complete.jpg`(61,254바이트)에 저장했다. 이 콘텐츠 등급 완료는 앱 검토 전송을 뜻하지 않는다.
- GitHub main에 [27cec8350052133916dd98978a280d40cc0fffd0](https://github.com/hebi10/pushOffice_app/commit/27cec8350052133916dd98978a280d40cc0fffd0) 게시가 완료되었다. 배포 빌드는 Expo EAS 대신 GitHub Actions로 진행한다. [실행 41588844929](https://github.com/hebi10/pushOffice_app/actions/runs/41588844929)는 전체 성공했다. Gradle은 19분 18초, 최종 unsigned 검증·artifact 게시까지 통과했다. 업로드 키 확보·서명 완료·Play 업로드는 아직 아니다.
- 기존 업로드 키는 아직 확보하지 못했다. GitHub 저장소 Secrets 화면과 로컬 작업 공간에서 기존 키 부재를 확인했다. 과거 Expo CLI 조회는 인증 세션 부재로 완료하지 못했고, 이후 보관 키 조회 한 차례는 자동 승인 검토가 ‘사용자의 GitHub 선호 및 민감 키 조회’를 이유로 접근을 차단하여 중단했다. 거절된 접근을 우회하지 않았다. 키 조회 차단은 완료된 IARC 사용자 승인과 별개다. GitHub 빌드 성공을 업로드 키 확보로 간주하지 않으며 원래 키와 Play Console 인증서 대조가 필요하다. 자격 증명 값은 출력하거나 등록 자료에 포함하지 않는다.
- 키 확인 이후 GitHub Actions 서명 실행은 다시 시작하지 않았다. 서명된 AAB는 없고 Play 검토도 전송하지 않았다.
- GitHub 빌드·서명 도구의 Python 테스트 17개와 기존 실제 AAB를 사용한 unsigned 경로·bundletool 통합 검증이 통과했다. 설정에 공개 정책·지원 버튼을 추가한 뒤 타입·린트 검사도 다시 통과했다. 실제 기존 키 서명 성공 경로는 키 부재로 실행하지 않았다.

세부 감사 자료는 store-assets/data-safety-evidence.md와 registration-status.json에 있다. 빌드 증거는 작업 공간 tooling/logs/play-aab-verification.json 및 play-aab-unsigned-preparation.json에 보존한다.

## GitHub 최종 AAB

실행 41588844929의 artifact 13209608492를 내려받아 ZIP digest와 AAB digest를 대조했다. AAB는 62,295,369바이트, SHA-256 `244f71614e52014bc39bc160c045c52a9c2e8f7c9e46dd4d1c29a0af96a8f903`이다. 패키지/버전/SDK26·36/debuggable false, 차단 권한 없음, ABI 3종 각 23개 라이브러리, 64비트 ELF 46개 16KB 정렬, bundletool 검증을 통과했다. 미서명으로 표시되어 있고 Play에는 업로드하지 않았다. 위의 9bd3019f… 로컬 준비본은 이전 참조 자료이며 이번 무환경값 GitHub 빌드의 대체 파일이 아니다.
