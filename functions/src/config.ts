/**
 * 환경변수 및 상수 설정
 * Firebase Functions는 functions/.env 파일을 자동으로 로드합니다.
 */

export const config = {
  openweatherKey: process.env.OPENWEATHER_KEY ?? "",
  newsApiKey: process.env.NEWS_API_KEY ?? "",
  alphaVantageKey: process.env.ALPHAVANTAGE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
} as const;

/** 캐시 TTL: 10분 (ms) */
export const CACHE_TTL_MS = 10 * 60 * 1000;

/** API 실패 시 최대 재시도 횟수 */
export const MAX_RETRIES = 3;

/** Rate limit: 분당 최대 요청 수 */
export const RATE_LIMIT_MAX = 30;

/** Rate limit 윈도우 (ms) */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
