import { Timestamp } from 'firebase/firestore';

// ─── 저장 모드 ───
export type StorageMode = 'firebase' | 'local';

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
  title: string;
  startAt: Timestamp;
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
  stockTickers: string[];
  newsLanguage: string;
  newsKeywords: string[];
}
