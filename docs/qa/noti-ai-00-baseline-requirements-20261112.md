# NOTI-AI-00 — 알림 일정 인식률 기준선·개선 요구사항

기준: 2026-11-12 / Asia/Seoul / main=df01ed7a66a8ba1d004308d1cddb3a4f91460348
기획 문서: https://docs.google.com/document/d/1HMLAr5KKDQ1peNKsfkCTyqFIfptxJG38K3h4B8ry9W8/edit
신규 Drive 기준선: https://docs.google.com/document/d/1vLZpkj_y7H20-ojMU2MVkqsfqHRJG2PkI6JHsGF7OUI/edit (05_PushOffice_일정관리 폴더)
범위: 합성 데이터 기반 Kotlin 실제 알림 필터·일정 파서 오프라인 측정. 실제 앱 기능·서명·Play 변경 없음.

## 1. 현행 구조

1. ScheduleNotificationListener.onNotificationPosted: Android 알림 접근 권한, 사용자 별도 ON 설정 시 수신 알림 제목·본문을 읽음. 그룹 요약, 지속 알림, 비공개 표시 알림, 자체 앱 알림은 제외. 동시 처리 최대 2건.
2. NotificationSuggestionPolicy.candidate: 날짜 AND 시간 둘 다 있어야 통과. OTP·인증·비밀번호·금융·계좌·결제·광고 등 위험 키워드는 선제 제외.
3. ScheduleParser.parse: 미래 날짜·시간, 한글 상대 날짜/요일, 월/연 반복 파싱 후 오류면 거절. 일정 의도(취소, 방송, 배송, 미확정 등) 전용 분류는 없음.
4. NotificationSuggestionStore: 후보 최대 24건/48시간, 중복 방지, 앱 내 저장, 기능 OFF 시 후보·중복 기록 삭제. 승인 없는 일정 자동 저장은 없음.
5. refineNotificationSuggestion: 앱 화면이 켜져 있고 사용자가 선택했을 때 기기 AI로 추가 분석. 모든 알림 실시간 AI 처리와 대화방 과거 대화 조회 기능은 없음.

## 2. 측정 방법

시각: 2026-11-12 10:00 Asia/Seoul 고정.

합성 알림 60건 구성:
- 확정 일정 24건(날짜+시각이 충분하고 개인 일정 의도가 있는 문장)
- 불완전 일정 12건(날짜·시각 부족, 문맥이 필요한 약속 제안 등)
- 일정 무관 14건(방송, 배송, 취소, 뉴스 등)
- 민감 정보 10건(OTP, 비밀번호, 금융, 계좌, 결제, 광고 등)

실제 사용자의 카카오톡·SMS 원본, 이름/연락처/비밀번호, 알림 접근 권한을 수집하지 않는다. 가상 문장을 사용하는 오프라인 재현 테스트이다.

1단계: production Kotlin NotificationSuggestionPolicy.candidate 통과 여부.
2단계: 동일 문자열에 production Kotlin ScheduleParser.parse 적용. 오류/시각 누락/제목 누락/변경 명령이 없다면 최종 후보 채택.
양성 라벨: 확정+불완전 36건. 음성 라벨: 무관+민감 24건.
TP/FP/FN/TN, precision, recall 산출. 확정 일정 24건은 기대 로컬 날짜·시각과 반복 유형이 정확한지 별도 계산. 불완전 문장에 시간을 임의 보충하지 않는다.
민감 10건은 파서 이전 필터 단계 차단률을 별도 측정한다.

실행: Gradle :push-office-native:testDebugUnitTest → report: modules/push-office-native/android/build/reports/noti-ai-00/baseline.json → tools/qa/verify_noti_ai_00.py 검증 → GitHub Actions 아티팩트.
JSON에는 테스트 ID와 판정 결과만 기록하고, 알림 원문을 남기지 않는다. 픽스처 SHA-256과 고정 시각·모델 미실행·실기기 미검증 상태도 기록한다.

**이 60건 결과는 합성 예문에서의 production Kotlin 경로 기준선일 뿐 실제 사용자 인식률, 배터리, 모델 추론 정확도, Android OS 알림 도착률은 아니다.**

## 3. 측정 지표

| 지표 | 산식 | 판정 목적 |
| --- | --- | --- |
| 후보 정밀도 | 후보 TP / (TP+FP) | 1단계 과잉 추천 |
| 후보 재현율 | 후보 TP / 36 | 선별 단계 누락 |
| 최종 정밀도 | 최종 TP / (TP+FP) | 규칙 파서 오탐 |
| 전체 의도 재현율 | 최종 TP / 36 | 불완전 일정 포함 누락 |
| 확정 일정 재현율 | 최종 확정 일정 인식 / 24 | 명확한 메시지 인식 |
| 불완전 의도 재현율 | 불완전 의도 최종 인식 / 12 | 개선 필요 범위 |
| 날짜·시각·반복 일치 | 정확한 결과 / 24 | AI 없는 현재 일정 정확성 |
| 민감 알림 차단 | 최초 단계 차단 / 10 | 보안 경계 |
| FN/FP 테스트 ID | 개별 사례 ID 목록 | NOTI-AI-01 회귀 데이터 |

실제 수치는 Actions가 Kotlin 단위 테스트를 실행한 뒤 생성되는 baseline.json에서 확인. 테스트 개수를 실제 측정 결과로 오인하지 않는다.

## 4. 후속 개선 요구사항 확정

N01 (P0): 3단계 로컬 분류. confirmed_candidate(확정 일정), needs_confirmation(시간 미정/미확정), discard(일정 무관/민감)를 구분한다. 불완전한 후보를 확정 시간으로 채워 자동 저장하지 않는다.
N02 (P0): 취소·방송·배송·조건부 질문·과거 일정 등에 대한 의미 분류. 원문에 없는 날짜를 생성하거나 AI JSON을 그대로 SQLite에 저장하지 않는다. 월말/윤년/시간대/DST/중복 검사를 네이티브에서 유지한다.
N03 (P0): 현재 민감 키워드 제외, 기능 기본 OFF, Android 권한·별도 동의, 후보 최대 24건·48시간, 기능 OFF 시 기록 삭제, 사용자 승인 전 자동 저장 금지 모두 보존. 클라우드 송신·채팅방 전체 내역 수집 금지. 앱별 허용 목록은 별도 명시적 동의·정책을 확정한 뒤 도입.
N04 (P1): 추천 카드에 원본 앱, 날짜 확정성, 확인 필요 상태, 검토·수정·거절을 구분. 기기 AI 미지원·실패 시 로컬 결과/직접 입력 보존. 알림 원문을 잠금 화면에 자동 표시하지 않는다.
N05 (P0): 실제 기기 API29/35/36 권한 허용·거부·철회, 알림 숨김, 앱 강제 종료·절전·재부팅, 알림 폭주, KakaoTalk/SMS 표면 테스트. 실제 메시지는 사용자가 익명화·동의한 자료만 사용. 앱별 분석률·지연·발열·배터리·RAM은 실기기에서 따로 검증. Gemini Nano는 앱 전면 실행 제약 준수.
N06 (P0/목표, 아직 미검증): 확정 일정 재현율 90% 이상, 추천 정밀도 95% 이상, 명확한 날짜·시각 정확도 98% 이상, 민감 알림 최초 필터 차단 100%, 자동 일정 저장 0건. 합성 테스트만으로 목표 합격을 인정하지 않음. 불완전 일정 기준은 실제 대조군 측정 후 확정.

## 5. 이번 단계 보존·제외

본 PR은 테스트 fixture, Android Kotlin 오프라인 측정 테스트, 보고서 검증기, CI 아티팩트와 문서만 추가한다.
NotificationListener/Store/Parser/NativeModule, AndroidManifest, SQLite, 알람, AI 모델 및 SHA-256, 기기 권한, 서명, Play 트랙, 실제 화면은 변경하지 않는다.
실제 알림 로깅, 원문 업로드, 기기 AI 자동 백그라운드 실행, 후보 스키마 변경, Google Play 재배포, PR 자동 병합은 이번 범위에서 제외한다.

## 6. 다음 작업

NOTI-AI-01 — 후보 3단계 분류·일정 의도/취소 탐지 개선. 본 기준선의 실패 ID를 회귀 테스트에 활용하고 민감 정보 차단/사용자 승인 계약을 보존한다.
