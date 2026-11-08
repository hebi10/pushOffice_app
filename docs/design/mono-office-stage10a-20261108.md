# Push Office — Mono Office 10-A: 공통 컬러 디자인 시스템

기준일: 2026-11-08. 기준 프로젝트: `hebi10/pushOffice_app`의 Expo/React Native 테마. 작업 범위는 **컬러 토큰과 대비 검증**으로 제한합니다.

## 목표

홈·캘린더·설정 등 React Native 화면의 파란색 중심 강조를 화이트·차콜 계열로 일원화합니다. 기존 달력 브랜드마크는 보존하고 브랜드 블루만 `brandAccent`에 남깁니다. 이미지·아이콘·컴포넌트 구조·위젯 레이아웃은 변경하지 않으며, Android 위젯의 색상 XML만 RN 시맨틱 팔레트와 동기화합니다.

## 토큰표

| 시맨틱 역할 | 속성 | Light | Dark |
|---|---|---|---|
| 앱 배경 | `background` | `#F7F8FA` | `#111315` |
| 카드·헤더·탭 | `surface` | `#FFFFFF` | `#1C1F22` |
| 구분선·카드 경계 | `surfaceBorder`, `divider` | `#DDE1E5` | `#3B4046` |
| 기본 텍스트 | `text` | `#1C1E21` | `#F5F6F7` |
| 보조 텍스트 | `textSecondary` | `#5D6269` | `#B1B6BD` |
| 3순위 텍스트 | `textTertiary` | `#656C74` | `#A1A7AF` |
| 주요 동작·선택 텍스트 | `primary` | `#23262B` | `#E7E9EC` |
| 주요 버튼 텍스트 | `onPrimary` | `#FFFFFF` | `#111315` |
| 브랜드 블루(제한 사용) | `brandAccent` | `#2563EB` | `#93C5FD` |
| 선택/강조의 중성 표면 | `primaryLight` | `#ECEEF1` | `#292D31` |
| 입력 배경 | `inputBackground` | `#ECEEF1` | `#292D31` |
| 입력 테두리(3:1 이상 대비) | `inputBorder` | `#818891` | `#777F88` |
| 삭제·오류 | `danger` | `#B42318` | `#FF7878` |
| 삭제 버튼 글자 | `onDanger` | `#FFFFFF` | `#111315` |
| 성공 | `success` | `#0B7850` | `#6DE0B2` |
| 채팅 사용자 말풍선 | `chatUserBubble` | `#23262B` | `#E7E9EC` |
| 채팅 사용자 텍스트 | `chatUserText` | `#FFFFFF` | `#111315` |
| 채팅 비서 말풍선 | `chatAssistantBubble` | `#FFFFFF` | `#292D31` |
| 채팅 비서 텍스트 | `chatAssistantText` | `#1C1E21` | `#F5F6F7` |

`chatAssistantBorder`는 `surfaceBorder`를 사용합니다. `tabBar`와 `headerBackground`는 `surface`와 동일하며, 시스템 상태바 밝기는 라이트 테마에서 `dark`, 다크 테마에서 `light`입니다.

## 코드 영향

- `src/lib/theme.ts`: 기존 `AppColors` 인터페이스를 보존해 모든 화면이 새 팔레트에서 색상을 가져가도록 수정합니다. 파란색 주 동작과 하이라이트 대신 `primary` 차콜과 `primaryLight` 중성 회색을 사용합니다.
- `src/contexts/ThemeContext.tsx`: 기존 시스템/라이트/다크 선택 로직 유지. 색상 정의만 교체하므로 로직 변경 없음.
- `src/lib/designTokens.ts`: 기존 간격·라운드·크기·타이포그래피 값 유지. 10-C에서 카드·모달 디자인과 함께 검토합니다.
- `modules/push-office-native/android/src/main/res/values*/colors.xml`: 위젯의 배경/글자/버튼/테두리 색상만 RN 시맨틱 팔레트에 맞게 변경. 위젯 크기·배치·동작은 그대로 유지합니다.
- `tests/ui-design-system-stage1.test.mjs`: 이전 브랜드 색상값을 새로운 규격으로 갱신합니다.
- `tests/ui-mono-office-stage10a.test.mjs`: 라이트/다크 토큰 매칭, 텍스트 대비 4.5:1, 입력 테두리 3:1, 상태색·브랜드색 대비를 자동 검증합니다.

## 후속 단계에 남기는 범위

10-B: 기존 브랜드마크·일러스트의 이미지 자체와 Android 앱/스토어 아이콘 조정.
10-C: 카드/버튼/모달 등 공통 UI의 여백·라운드·아이콘 표현 개선.
10-D: 홈·캘린더·설정 화면의 정보 위계 정리 및 고정 색상 사용처 조사.
10-E: Kotlin `QuickEntryActivity`의 네이티브 입력창·다이얼로그·빠른 설정 타일 스타일과 위젯의 레이아웃·아이콘·상태 표시 정밀 보정. 위젯의 컬러 XML은 10-A에서 우선 동기화합니다.
10-F: 실기기·시스템 테마 변경·130% 폰트·태블릿 QA 및 최종 배포 검토.

현재 단계에서 **위젯 색상 XML은 업데이트했으나 네이티브 입력창·다이얼로그·타일의 하드코딩 블루는 후속 작업**으로 남기므로 앱 전체의 완전한 모노톤 통일은 10-E 이후에만 판정합니다. `main`에 병합될 때 자동 내부 테스트 배포가 시작될 수 있으므로 별도 PR 검증 중에는 병합하지 않습니다.

## 기준 자료

- [Mono Office 전체 기획서](https://docs.google.com/document/d/1T5X0QDswTEjC2FrUzWmmHjzPfaRjmUHsgni8a_TKa24/edit)
- [Android 화면 캡처](https://github.com/hebi10/pushOffice_app/actions/runs/42474233145)
- [Push Office 저장소](https://github.com/hebi10/pushOffice_app)
