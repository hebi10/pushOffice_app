import { Timestamp } from 'firebase/firestore';

// ─── 저장 모드 ───
export type StorageMode = 'firebase' | 'local';

// ─── 테마 / 폰트 ───
export type ThemeMode = 'system' | 'light' | 'dark';
export type FontFamily = 'pretendard' | 'noto-sans' | 'nanum-gothic' | 'nanum-myeongjo';

// ─── 일정 타입 ───
export type ScheduleType = 'schedule' | 'reminder' | 'memo';

// ─── Firestore 모델 ───
export interface UserDoc {
  uid: string;
  timezone: string;
  pushEnabled: boolean;
  dailyBriefingEnabled: boolean;
  dailyBriefingTime: { hour: number; minute: number };
  /** 브리핑 항목 토글 */
  digestTypes: DigestTypes;
  /** 날씨 도시 */
  digestCity: string;
  /** 관심 주식 종목 */
  stockTickers: string[];
  /** 뉴스 언어 */
  newsLanguage: string;
  /** 뉴스 키워드 */
  newsKeywords: string[];
  /** Expo Push Token 목록 */
  expoPushTokens: string[];
  /** 마지막 브리핑 발송 날짜 */
  digestLastSentDateKey: string;
  /** 마지막 브리핑 발송 시각 */
  digestLastSentAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DigestTypes {
  weather: boolean;
  stocks: boolean;
  news: boolean;
}

export type RepeatType = 'none' | 'monthly' | 'yearly';

export interface ScheduleDoc {
  id?: string;
  userId: string;
  type: ScheduleType;
  title: string;
  startAt: Timestamp;
  endAt?: Timestamp | null;
  isAllDay?: boolean;
  repeatType: RepeatType;
  notificationEnabled: boolean;
  notificationId: string | null;
  sourceText: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Digest 모델 ───
export interface DigestDoc {
  id?: string;
  ownerType: 'user' | 'device';
  ownerId: string;
  dateKey: string; // YYYY-MM-DD
  types: DigestTypes;
  title: string;
  summary: string;
  contentMarkdown: string;
  sources: Array<{ label: string; url?: string }>;
  createdAt: number;
  updatedAt: number;
}

// ─── 파싱 결과 ───
export interface ParseResult {
  titleCandidate: string;
  startAtISO: string | null;
  repeatType: RepeatType;
  missingFields: string[];
}

export interface AIParseResponse {
  title: string;
  startAtISO: string;
  repeatType: RepeatType;
  followUpQuestions: string[];
  missingFields: string[];
}

// ─── 채팅 메시지 ───
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  scheduleData?: Partial<ParseResult>;
  /** 연결된 일정 ID (채팅 내역에서 수정/취소용) */
  scheduleId?: string;
  /** 취소 여부 */
  cancelled?: boolean;
}

// ─── 채팅 히스토리 (영속) ───
export interface ChatHistoryDoc {
  id?: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ─── 날씨 지역 ───
export interface WeatherRegion {
  sido: string;
  gugun: string;
  dong?: string;
}

// ─── 날씨 ───
export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
}

// ─── 설정 ───
export interface UserSettings {
  timezone: string;
  pushEnabled: boolean;
  dailyBriefingEnabled: boolean;
  dailyBriefingTime: { hour: number; minute: number };
  digestTypes: DigestTypes;
  digestCity: string;
  /** 날씨 지역 (행정구역 선택) */
  weatherRegion: WeatherRegion | null;
  stockTickers: string[];
  newsLanguage: string;
  newsKeywords: string[];
  /** 뉴스 카테고리 */
  newsCategories: string[];
  themeMode: ThemeMode;
  fontFamily: FontFamily;
}

// ─── 다중 일정 미리보기 ───
export interface SchedulePreviewItem {
  title: string;
  startAtISO: string;
  endAtISO?: string | null;
  isAllDay: boolean;
  repeatType: RepeatType;
  selected: boolean;
}
