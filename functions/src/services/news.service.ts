/**
 * News Service – NewsAPI.org
 *
 * 무료 플랜: 100 requests/day (개발 전용)
 * 한국 뉴스 top-headlines, 10분 캐시 적용
 */
import * as logger from "firebase-functions/logger";
import { CACHE_TTL_MS, config } from "../config.js";
import { cache } from "../utils/cache.js";
import { withRetry } from "../utils/retry.js";

export interface NewsItem {
  title: string;
  description: string;
  publishedAt: string;
}

export async function fetchNews(
  country = "kr",
  pageSize = 5,
): Promise<NewsItem[]> {
  const cacheKey = `news:${country}:${pageSize}`;

  const cached = cache.get<NewsItem[]>(cacheKey);
  if (cached) {
    logger.info("뉴스 캐시 히트", {cacheKey});
    return cached;
  }

  try {
    const result = await withRetry(async () => {
      const url =
        `https://newsapi.org/v2/top-headlines` +
        `?country=${country}` +
        `&pageSize=${pageSize}` +
        `&apiKey=${config.newsApiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NewsAPI 오류: ${response.status}`);
      }

      const data = await response.json() as {
        articles: Array<{
          title: string;
          description: string | null;
          publishedAt: string;
        }>;
      };

      return data.articles.map((a) => ({
        title: a.title,
        description: a.description ?? "",
        publishedAt: a.publishedAt,
      }));
    }, "News");

    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  } catch (err) {
    // API 실패 시 이전 캐시 데이터 반환
    const stale = cache.getStale<NewsItem[]>(cacheKey);
    if (stale) {
      logger.warn("뉴스 API 실패 → 이전 캐시 데이터 반환");
      return stale;
    }
    throw err;
  }
}
