# Push Office · PO-UI-01 공통 디자인 시스템

기준: 2026-11-05 · 2차 리디자인 1/8단계

## 시각 언어
- **Primary 액션:** `#2563EB` · 흰 글자 대비 약 **5.17:1** (라이트)
- **Brand Accent:** `#4B94DC` · 일러스트와 보조 장식, **작은 흰 글자 배경으로 사용하지 않음** (대비 약 3.20:1)
- **Destructive 액션:** `#B91C1C` + 흰 글자 (라이트), `#FF6B6B` + 어두운 글자 (다크)
- **다크 Primary:** `#5B9FE6` + `#121212` 글자
- 배경·표면·테두리·본문·보조 텍스트 등은 `src/lib/theme.ts`의 `lightColors` / `darkColors`로 관리

## 공간과 글꼴 토큰

`src/lib/designTokens.ts`를 공통 기준으로 사용합니다.

| 용도 | 공통값 |
|---|---|
| 화면 좌우 | 16 |
| 카드 안쪽 | 16 |
| 카드 모서리 | 16 |
| 버튼 모서리 | 12 |
| 입력창 모서리 | 10 |
| 모달 최대 가로 | 440 |
| 주요 버튼 최소 높이 | 50 |
| 터치 요소 최소 높이 | 48 |
| 화면 제목 | 26 / 34, 800 |
| 카드 제목 | 17 / 23, 700 |
| 본문 | 15 / 23 |
| 캡션 | 12 / 18 |

Pretendard·NotoSansKR·나눔 계열 파일이 **번들에 없는 상태**이므로 React Native 컴포넌트에 없는 글꼴 이름을 지정하지 않습니다. 저장된 폰트 선호값은 변경하지 않되, 실제 출력은 `APP_FONT_FAMILY`로 일치시켰습니다. 별도 라이선스와 폰트 자산을 확보하면 해당 자산을 로드하는 방식으로 전환합니다.

## 공통 컴포넌트

`src/components/AssistantUI.tsx`:
- `AssistantCard`: 제목·보조 설명·아이콘을 기존 기능 그대로 표시, 공통 카드 경계 사용
- `AssistantButton`: `variant="primary" | "secondary" | "destructive"`. 기존의 `secondary` prop도 호환 유지
- `AssistantTextField`: 라벨·입력값·키보드 타입·문자 길이와 공통 입력 필드 스타일
- `SettingRow`: 제목·설명·스위치 상태(선택·비활성화) 공통화
- `assistantStyles`: 기존 화면에서 사용하는 `content`, `heading`, `body`, `caption`, `input`, `row`의 API 호환 유지

기본 예시:

```tsx
<AssistantButton label="일정 저장" icon="checkmark-outline" onPress={save} />
<AssistantButton label="취소" icon="close-outline" variant="secondary" onPress={back} />
<AssistantButton label="일정 삭제" icon="trash-outline" variant="destructive" onPress={confirmDelete} />
<SettingRow title="일정 알림" value={enabled} onValueChange={setEnabled} />
<AssistantTextField label="제목" value={title} onChangeText={setTitle} />
```

`Card`, `ScreenIntro`, `AppDialog`, `EmptyState`, `Loading`도 같은 토큰을 사용합니다. 앱 자체 안내 모달은 스크롤 가능하며, 큰 글꼴에서도 터치 높이를 유지합니다.

## 도입을 보류한 컴포넌트
`SectionHeader`·`StatusChip`은 현 단계에 명확한 반복 사용 사례가 적어 만들지 않았습니다. 실제 재사용 필요 여부를 2·4단계에서 판단합니다. `DateTimeField`는 일정 상세 화면의 선택·유효성 검사 흐름과 결합되어 있어 6단계에서 작업합니다.

## 기존 기능 보존
- 홈·일정·설정 3개 탭 유지
- 일정 CRUD, 반복, 타임존, 알림, 재알림, 음성 입력, AI, Firebase 복구 관련 동작 변경 없음
- 기존 설정 함수의 서명·저장 처리는 그대로 두고 행·필드만 공통 컴포넌트화
- 신규 패키지·폰트 파일·그라데이션·애니메이션 추가 없음
- Android OS가 직접 소유하는 권한창은 변경하지 않음

## 검증 기준
`tests/ui-design-system-stage1.test.mjs`에서 라이트/다크 주요 텍스트 대비(4.5:1 이상), 공통 토큰, 호환 컴포넌트 및 기존 주요 저장 연결을 검사합니다. `ui-validation.yml`의 Node 테스트·TypeScript·ESLint·Expo 번들·Android Kotlin 테스트 및 디버그 빌드가 모두 성공해야 PR을 병합합니다.

에뮬레이터 캡처는 별도의 시각 검증 자료입니다. 실제 Play 업로드 성공 여부는 서명된 APK/AAB 생성과 구분합니다.
