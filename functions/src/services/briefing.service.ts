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

import type {BriefingRequest} from "../briefingPolicy.js";

export interface BriefingOutput {
  generatedAt: string;
  briefingText: string;
  weather: WeatherResult | null;
  news: NewsItem[] | null;
  stock: StockResult | null;
  /** 복수 종목 결과 */
  stocks: StockResult[];
}

// ─── 메인 브리핑 생성 ──────────────────────────────────────
export async function generateBriefing(
  input: BriefingRequest,
): Promise<BriefingOutput> {
  const types = input.types;
  const {lat, lon, newsCountry} = input;
  const tickers = input.stockTickers ?? [];
  if (types.weather && (lat === undefined || lon === undefined)) throw new Error("Missing validated coordinates");
  if (types.news && !newsCountry) throw new Error("Missing validated news country");
  if (types.stocks && !tickers.length) throw new Error("Missing validated symbols");

  // 서비스 병렬 호출 (Promise.allSettled → 하나가 실패해도 나머지 계속)
  const [weatherResult, newsResult, ...stockResults] =
    await Promise.allSettled([
      types.weather && lat !== undefined && lon !== undefined ? fetchWeather(lat, lon) : Promise.resolve(null),
      types.news && newsCountry ? fetchNews(newsCountry, 5) : Promise.resolve(null),
      ...(types.stocks
        ? tickers.map((t) => fetchStock(t))
        : [Promise.resolve(null)]),
    ]);

  const weather =
    weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const news =
    newsResult.status === "fulfilled" ? newsResult.value : null;

  // 복수 종목 결과
  const stocks: StockResult[] = stockResults
    .filter(
      (r): r is PromiseFulfilledResult<StockResult> =>
        r.status === "fulfilled" && r.value != null,
    )
    .map((r) => r.value);
  const stock = stocks[0] ?? null;

  // 실패 로그
  if (weatherResult.status === "rejected") {
    logger.warn("날씨 서비스 실패");
  }
  if (newsResult.status === "rejected") {
    logger.warn("뉴스 서비스 실패");
  }
  stockResults.forEach((r) => {
    if (r.status === "rejected") {
      logger.warn("주식 서비스 실패");
    }
  });

  // AI 요약 생성 (OpenAI 키 없으면 기본 템플릿)
  if (!weather && !news?.length && !stocks.length) throw new Error("No provider data");
  const briefingText = await generateAISummary({weather, news, stocks});

  return {
    generatedAt: new Date().toISOString(),
    briefingText,
    weather,
    news,
    stock,
    stocks,
  };
}
