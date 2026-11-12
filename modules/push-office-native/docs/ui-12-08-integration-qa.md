# QA-12-08 — 최종 main 네이티브 계측 트리거

기준: `main=4d532eb43a0d3d8d00755cf46019c3162b2d6db5` — UI-12-02~07 PR #55~60 순차 병합 완료. QA PR #61은 최신 main의 합친 소스와 QA-only 워크플로/문서를 함께 검사한다.

API29: `Push Office Mono Office native instrumentation`에서 실제 위젯·타일·네이티브 입력 계측.
API35/36: `.github/workflows/ui-12-08-android-matrix.yml`의 각 OS API 레벨 계측·디버그 앱 실행·홈 PNG.
전체 화면: `Push Office UI screenshots`, Android API29 실제 61 PNG와 manifest warnings=[].

삼성 One UI/ARM64·Gemini Nano 실제 기기 및 160%·200% 큰 글꼴은 독립 증빙이 없으므로 미검증. QA 성공은 Play 릴리스 승인이 아니며 내부/비공개 트랙 publish를 이 커밋에서 실행하지 않는다.
