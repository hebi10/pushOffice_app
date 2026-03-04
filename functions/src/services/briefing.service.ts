/**
 * Briefing Service – 통합 브리핑 오케스트레이터
 *
 * 1. weather.service 호출
 * 2. news.service 호출
 * 3. stock.service 호출
 * 4. ai.ts 통해 요약 생성
 * 5. JSON 응답 반환
 */
import * as logger from "firebase-functions/logger";
import { generateAISummary } from "../utils/ai.js";
import { fetchNews, type NewsItem } from "./news.service.js";
import { fetchStock, type StockResult } from "./stock.service.js";
import { fetchWeather, type WeatherResult } from "./weather.service.js";

// ─── 도시 → 좌표 매핑 (한국 주요 도시) ─────────────────────
const CITY_COORDS: Record<string, {lat: number; lon: number}> = {
  "서울": {lat: 37.5665, lon: 126.9780},
  "부산": {lat: 35.1796, lon: 129.0756},
  "대구": {lat: 35.8714, lon: 128.6014},
  "인천": {lat: 37.4563, lon: 126.7052},
  "광주": {lat: 35.1595, lon: 126.8526},
  "대전": {lat: 36.3504, lon: 127.3845},
  "울산": {lat: 35.5384, lon: 129.3114},
  "세종": {lat: 36.4800, lon: 127.0000},
  "제주": {lat: 33.4996, lon: 126.5312},
  "수원": {lat: 37.2636, lon: 127.0286},
  "창원": {lat: 35.2281, lon: 128.6811},
  "고양": {lat: 37.6584, lon: 126.8320},
  "용인": {lat: 37.2411, lon: 127.1776},
  "성남": {lat: 37.4201, lon: 127.1265},
};

function getCoordsForCity(city?: string): {lat: number; lon: number} {
  if (!city) return CITY_COORDS["서울"];
  return CITY_COORDS[city] ?? CITY_COORDS["서울"];
}

// ─── 인터페이스 ────────────────────────────────────────────
export interface BriefingInput {
  lat?: number;
  lon?: number;
  city?: string;
  types?: {weather: boolean; stocks: boolean; news: boolean};
  stockTickers?: string[];
  newsLanguage?: string;
}

export interface BriefingOutput {
  generatedAt: string;
  briefingText: string;
  weather: WeatherResult | null;
  news: NewsItem[] | null;
  stock: StockResult | null;
}

// ─── 메인 브리핑 생성 ──────────────────────────────────────
export async function generateBriefing(
  input: BriefingInput,
): Promise<BriefingOutput> {
  const types = input.types ?? {weather: true, stocks: true, news: true};

  // 좌표 결정: 직접 입력 > 도시명 > 기본값(서울)
  let lat = input.lat;
  let lon = input.lon;
  if (lat == null || lon == null) {
    const coords = getCoordsForCity(input.city);
    lat = coords.lat;
    lon = coords.lon;
  }

  // 3개 서비스 병렬 호출 (Promise.allSettled → 하나가 실패해도 나머지 계속)
  const [weatherResult, newsResult, stockResult] = await Promise.allSettled([
    types.weather ? fetchWeather(lat, lon) : Promise.resolve(null),
    types.news ? fetchNews("kr", 5) : Promise.resolve(null),
    types.stocks
      ? fetchStock(input.stockTickers?.[0] ?? "TSLA")
      : Promise.resolve(null),
  ]);

  const weather =
    weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const news =
    newsResult.status === "fulfilled" ? newsResult.value : null;
  const stock =
    stockResult.status === "fulfilled" ? stockResult.value : null;

  // 실패 로그
  if (weatherResult.status === "rejected") {
    logger.error("날씨 서비스 실패", weatherResult.reason);
  }
  if (newsResult.status === "rejected") {
    logger.error("뉴스 서비스 실패", newsResult.reason);
  }
  if (stockResult.status === "rejected") {
    logger.error("주식 서비스 실패", stockResult.reason);
  }

  // AI 요약 생성 (OpenAI 키 없으면 기본 템플릿)
  const briefingText = await generateAISummary({weather, news, stock});

  return {
    generatedAt: new Date().toISOString(),
    briefingText,
    weather,
    news,
    stock,
  };
}
