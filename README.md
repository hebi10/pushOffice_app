# AI Push Assistant

자연어로 일정을 등록하고, AI가 구조화하여 로컬 알림으로 관리하는 Expo(React Native) + Firebase 앱입니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Expo SDK 54 + TypeScript |
| 라우팅 | expo-router v6 |
| 패키지매니저 | pnpm |
| 상태관리 | Redux Toolkit (인증/설정) + TanStack Query (Firestore CRUD) |
| 백엔드 | Firebase (Auth, Firestore, Cloud Functions) |
| 알림 | expo-notifications (로컬 스케줄) |
| 달력 | react-native-calendars |
| AI | OpenAI API (Cloud Functions 프록시) |

---

## 프로젝트 구조

```
app/
  _layout.tsx              # Root layout (Provider 래핑)
  index.tsx                # → (tabs)로 리다이렉트
  (auth)/
    sign-in.tsx            # 로그인 화면
  (tabs)/
    _layout.tsx            # Bottom tabs
    index.tsx              # Home (자연어 등록 + 일정 리스트)
    calendar.tsx           # Calendar (월간 달력 + Agenda)
    briefing.tsx           # Briefing (날씨 + 오늘/내일 일정)
    settings.tsx           # Settings (알림/브리핑 설정)
  schedule/
    [id].tsx               # Schedule Detail + 재알림

src/
  components/              # 공통 UI 컴포넌트
  features/
    auth/                  # 인증 서비스 + 훅
    schedules/             # Firestore CRUD + Query hooks
    parsing/               # 로컬 파서 + AI 파서 클라이언트
    notifications/         # 권한/스케줄/리스너/재스케줄
    weather/               # OpenWeather API
  lib/
    firebase.ts            # Firebase 초기화
    env.ts                 # 환경변수 헬퍼
    time.ts                # dayjs 설정 + 시간 유틸
  store/
    store.ts               # Redux store
    slices/
      authSlice.ts
      settingsSlice.ts
  types/
    index.ts               # TypeScript 타입 정의

functions/
  src/index.ts             # Cloud Functions (parseSchedule)
  package.json
  tsconfig.json
```

---

## 설치 및 실행

### 1. 앱 의존성 설치

```bash
pnpm install
```

### 2. 환경변수 설정

`.env.example`을 `.env`로 복사한 후 Firebase / OpenWeather 키를 입력하세요.

```bash
cp .env.example .env
```

### 3. Firebase 설정

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Authentication → 익명 로그인 활성화
3. Firestore Database 생성 (테스트 모드)
4. 웹 앱 등록 후 `firebaseConfig` 값을 `.env`에 입력

### 4. Cloud Functions 배포

```bash
cd functions
npm install
cp .env.example .env   # OpenAI API Key 입력
npm run deploy
```

### 5. 앱 실행

```bash
pnpm start
# 또는
pnpm android
pnpm ios
```

---

## 핵심 기능 상세

### 자연어 파싱 (로컬 파서 → AI 보조)

**분기 조건:**
1. **로컬 파서 우선**: 입력 텍스트를 한국어 룰 기반으로 파싱
   - 상대일: 오늘, 내일, 모레
   - 절대 날짜: "3월 10일", "2026년 3월 10일"
   - 시간: "오전 9시", "오후 3시", "9:30"
   - 반복: "매달 25일", "매년 3월 10일"
2. **로컬 파싱 실패 시 AI 호출**: `missingFields`가 있거나 날짜를 추출하지 못한 경우
3. **AI 응답의 `followUpQuestions`로 채팅형 추가 질문** (최대 3개)
4. 사용자 확인("네") 후 Firestore 저장 + 알림 스케줄링

### Calendar 페이지

- **react-native-calendars** 월간 달력
- **마킹 로직**: Firestore에서 해당 월의 schedules를 조회하여 `startAt` 날짜에 dot 표시
- 날짜 탭 → 해당 날짜 일정 리스트 (Agenda 스타일)
- 우측 상단 "**+ 추가**" 버튼으로 빠른 일정 추가 (제목/시간 간단 입력)
- **타임존 처리**: dayjs의 timezone 플러그인으로 00:00 날짜 경계 처리

### 반복 알림 MVP 제약

> **중요**: 반복 일정(monthly/yearly)은 **저장 시 다음 1회만 알림 스케줄링**합니다.

- `expo-notifications`는 OS별로 반복 트리거 제약이 있으므로, MVP에서는:
  - 저장 시 "다음 예정 시각" 1회만 스케줄
  - **앱 실행(Home 진입)** 시 `rescheduleOverdueRepeating()` 호출
  - 지난 반복 일정을 감지하여 다음 회차 계산 → 재스케줄
- 백그라운드 태스크 없는 현실적 MVP 방식
- 앱을 장기간 열지 않으면 중간 회차 알림이 누락될 수 있음

### 재알림 (Schedule Detail)

일정 상세 화면에서 3가지 재알림 버튼 제공:
1. **1시간 뒤** – 현재 시각 기준 +1h
2. **내일 같은 시간** – startAt +1일
3. **다음 달 같은 날짜/시간** – 월말 31일→28일 등 자동 보정

모두 사용자가 직접 누른 경우에만 1회성 알림 생성.

---

## 알림 권한 / 테스트 방법

### iOS
- 첫 알림 스케줄 시 시스템 권한 팝업 표시
- 시뮬레이터에서는 알림 제한적 → **실 기기 테스트 권장**
- `expo-notifications` 플러그인이 `app.json`에 등록되어 있어야 함

### Android
- API 33+ (Android 13)부터 런타임 알림 권한 필요
- `schedules`, `briefing` 두 개의 Notification Channel 자동 생성
- 에뮬레이터에서 알림 정상 작동

### 알림 테스트
1. Home에서 "내일 오전 9시 테스트" 입력 → 저장
2. Settings에서 "일일 브리핑" 활성화 → 설정한 시간에 알림 확인
3. Schedule Detail에서 "1시간 뒤" 재알림 → 1시간 후 알림 확인
4. 하루 최대 8개 알림 제한 – 초과 시 경고 표시

---

## Firestore 보안 규칙 (예시)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /schedules/{docId} {
      allow read, write: if request.auth != null
        && resource == null || resource.data.userId == request.auth.uid;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 환경변수

### 앱 (`.env`)
| 변수명 | 설명 |
|--------|------|
| EXPO_PUBLIC_FIREBASE_API_KEY | Firebase API Key |
| EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase Auth Domain |
| EXPO_PUBLIC_FIREBASE_PROJECT_ID | Firebase Project ID |
| EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET | Firebase Storage Bucket |
| EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase Messaging Sender ID |
| EXPO_PUBLIC_FIREBASE_APP_ID | Firebase App ID |
| EXPO_PUBLIC_FUNCTIONS_BASE_URL | Cloud Functions Base URL |
| EXPO_PUBLIC_OPENWEATHER_API_KEY | OpenWeather API Key |

### Functions (`functions/.env`)
| 변수명 | 설명 |
|--------|------|
| OPENAI_API_KEY | OpenAI API Key |

---

## 라이선스

Private project.
