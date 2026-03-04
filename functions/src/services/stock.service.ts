/**
 * Stock Service – Alpha Vantage
 *
 * 무료 플랜: 25 requests/day
 * GLOBAL_QUOTE 엔드포인트 사용 (최신 가격 + 변동률을 1회 호출로 획득)
 * ※ TIME_SERIES_INTRADAY 대비 응답이 가볍고 무료 할당량 절약에 효율적
 * 10분 캐시 적용
 */
import * as logger from "firebase-functions/logger";
import { CACHE_TTL_MS, config } from "../config.js";
import { cache } from "../utils/cache.js";
import { withRetry } from "../utils/retry.js";

export interface StockResult {
  symbol: string;
  latestPrice: string;
  changePercent: string;
}

export async function fetchStock(symbol = "TSLA"): Promise<StockResult> {
  const cacheKey = `stock:${symbol}`;

  const cached = cache.get<StockResult>(cacheKey);
  if (cached) {
    logger.info("주식 캐시 히트", {cacheKey});
    return cached;
  }

  try {
    const result = await withRetry(async () => {
      const url =
        `https://www.alphavantage.co/query` +
        `?function=GLOBAL_QUOTE` +
        `&symbol=${symbol}` +
        `&apikey=${config.alphaVantageKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Alpha Vantage API 오류: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;

      // API 호출 한도 초과 시 'Note' 또는 'Information' 키 포함
      if ("Note" in data || "Information" in data) {
        throw new Error(
          "Alpha Vantage API 호출 한도 초과 (무료: 25 req/day)",
        );
      }

      const quote = data["Global Quote"] as
        | Record<string, string>
        | undefined;

      if (!quote || !quote["05. price"]) {
        throw new Error("주식 데이터를 찾을 수 없습니다");
      }

      return {
        symbol,
        latestPrice: parseFloat(quote["05. price"]).toFixed(2),
        changePercent: quote["10. change percent"] ?? "0%",
      };
    }, "Stock");

    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  } catch (err) {
    // API 실패 시 이전 캐시 데이터 반환
    const stale = cache.getStale<StockResult>(cacheKey);
    if (stale) {
      logger.warn("주식 API 실패 → 이전 캐시 데이터 반환");
      return stale;
    }
    throw err;
  }
}
