import type { DigestTypes } from '../../types';

export interface ExternalBriefingPayload {
  types: DigestTypes;
  city?: string;
  stockTickers?: string[];
  newsLanguage?: 'ko' | 'en';
}

export const BRIEFING_CITIES = [
  ['서울', 'seoul'], ['부산', 'busan'], ['대구', 'daegu'], ['인천', 'incheon'],
  ['광주', 'gwangju'], ['대전', 'daejeon'], ['울산', 'ulsan'], ['세종', 'sejong'],
  ['제주', 'jeju'], ['수원', 'suwon'], ['창원', 'changwon'], ['고양', 'goyang'],
  ['용인', 'yongin'], ['성남', 'seongnam'],
] as const;

export function normalizeBriefingCity(value: string | undefined): string {
  const city = value?.trim().toLowerCase() ?? '';
  const match = BRIEFING_CITIES.find(([ko, en]) => city === ko || city === en ||
    city === ko + '시' || (ko === '서울' && city === '서울특별시') ||
    (['부산', '대구', '인천', '광주', '대전', '울산'].includes(ko) && city === ko + '광역시') ||
    (ko === '세종' && city === '세종특별자치시'));
  if (!match) throw new Error('지원하는 날씨 도시를 입력해 주세요.');
  return match[0];
}

/** The authenticated endpoint is build-configured; no arbitrary host, URL credentials or query. */
export function isTrustedBriefingEndpoint(value: string): boolean {
  return /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:run\.app|cloudfunctions\.net)(?:\/generateDigest|\/)?$/i.test(value);
}

export function isSafeNewsLink(value: string | undefined): boolean {
  if (!value || value.length > 2048 || /\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch { return false; }
}

/** Explicit allowlist: local owner, date, time zone, keywords and schedule data never enter JSON. */
export function buildExternalBriefingPayload(input: {
  types: DigestTypes;
  city?: string;
  stockTickers?: string[];
  newsLanguage?: string;
  allowExternal?: boolean;
}): ExternalBriefingPayload {
  const { weather, stocks, news } = input.types;
  if (input.allowExternal !== true || typeof weather !== 'boolean' || typeof stocks !== 'boolean' ||
      typeof news !== 'boolean' || !(weather || stocks || news)) {
    throw new Error('외부 브리핑 항목을 선택해 주세요.');
  }
  const result: ExternalBriefingPayload = { types: { weather, stocks, news } };
  if (weather) result.city = normalizeBriefingCity(input.city);
  if (stocks) {
    const tickers = input.stockTickers ?? [];
    if (tickers.length < 1 || tickers.length > 5) throw new Error('주식 종목을 1~5개 선택해 주세요.');
    const normalized = tickers.map(symbol => symbol.trim().toUpperCase());
    if (normalized.some(symbol => !/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(symbol))) {
      throw new Error('주식 종목 형식을 확인해 주세요.');
    }
    result.stockTickers = [...new Set(normalized)];
  }
  if (news) {
    if (input.newsLanguage !== 'ko' && input.newsLanguage !== 'en') {
      throw new Error('뉴스 지역은 ko 또는 en으로 설정해 주세요.');
    }
    result.newsLanguage = input.newsLanguage;
  }
  return result;
}
