# Play 등록 준비 검증

버전 1.1.0(3), com.hebi96.pushOffice_app. 기존 Console 코드 2를 직접 확인한 뒤 새 코드를 선택했다.

- 생성 기능으로 만든 원본 아이콘을 보존하고 Android adaptive·monochrome·splash·favicon과 스토어 512px 아이콘·1024×500 배너를 내보냈다. 실제 캡처 6장을 전체 화면 비율을 유지한 1080×1920 레이아웃으로 정리했다.
- 카메라·외부 저장소 읽기/쓰기·다른 앱 위 표시 권한 4개를 app.json blockedPermissions로 제거했다. 새 AAB manifest에서도 모두 없는 것을 확인했다.
- TypeScript, 앱 범위 ESLint, Node 회귀 검사 50개, 공백 검사를 통과했다. 소프트웨어 실행 코드 변경 없이 아이콘·권한·버전 설정과 등록 자료를 반영했다.
- Gradle bundleRelease가 20분 21초, 작업 784개로 성공했다. bundletool/ZIP 검사, package/version/min26/target36, 세 ABI별 라이브러리 23개, 모든 ARM64 ELF의 16KB 정렬 및 BundleConfig PAGE_ALIGNMENT_16K를 확인했다.
- 생성된 원래 AAB에는 Android Debug 서명이 남아 있었다. 원본을 보존하고 별도 준비본에서 JAR 서명 항목 3개만 제거했다. 나머지 1,457개 항목의 이름·페이로드·메타데이터·로컬 ZIP 레코드가 동일하고 새 ZIP/bundletool 검사와 미서명 확인이 통과했다.
- 미서명 준비본 SHA-256: 9bd3019f930894be116c8d4636d722034618093432a1e10025f60ab2a46f6ec4. 크기 62,345,073바이트. 원래 업로드 키의 서명·인증서 대조 전에는 업로드하지 않는다.
- Play 기본 등록정보 전체 시각·문자 애셋과 7/11 설정을 저장했고, 생산성 카테고리를 선택했다. 지원 이메일은 비어 있다. 내부 테스트 임시 출시 4에 제목·한국어 노트를 저장했다. 새 AAB 업로드 및 검토 전송·출시는 하지 않았다.
- 데이터 보안은 수집 있음/새 계정 생성 없음의 일부 답변만 임시 저장했다. ML Kit 진단·식별자 수집과 선택적 외부 요청·이전 계정 복구를 근거 문서에 구분했다. 미확정 전송 암호화·운영 보관 기간·삭제 경로는 선언하지 않았다.
- 개인정보 안내는 DRAFT이고 공개하지 않았다. 지원 이메일, 공개 정책 URL/운영 정보 및 IARC 약관 동의가 필요하다.
- Expo CLI에 기존 인증 세션이 없어 기존 키를 조회하지 못했다. 새 기기 접근 승인 화면은 개인 hebi96 계정/Developer 범위만 선택한 채 승인하지 않고 남긴다. 자격 증명 값은 출력하거나 등록 자료에 포함하지 않는다.

세부 감사 자료는 store-assets/data-safety-evidence.md와 registration-status.json에 있다. 빌드 증거는 작업 공간 tooling/logs/play-aab-verification.json 및 play-aab-unsigned-preparation.json에 보존한다.
