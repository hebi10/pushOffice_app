/**
 * Weather Service – OpenWeather API
 *
 * 무료 플랜: 60 calls/min, 1,000,000 calls/month
 * 위도/경도 기반 요청, 10분 캐시 적용
 */
import * as logger from "firebase-functions/logger";
import { CACHE_TTL_MS, config } from "../config.js";
import { cache } from "../utils/cache.js";
import { withRetry } from "../utils/retry.js";

export interface WeatherResult {
  location: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  description: string;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherResult> {
  // 소수점 2자리까지 반올림하여 캐시 키 생성 (근접 좌표 캐시 공유)
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;

  const cached = cache.get<WeatherResult>(cacheKey);
  if (cached) {
    logger.info("날씨 캐시 히트", {cacheKey});
    return cached;
  }

  try {
    const result = await withRetry(async () => {
      const url =
        `https://api.openweathermap.org/data/2.5/weather` +
        `?lat=${lat}&lon=${lon}` +
        `&appid=${config.openweatherKey}` +
        `&units=metric&lang=kr`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OpenWeather API 오류: ${response.status}`);
      }

      const data = await response.json() as {
        name: string;
        main: {temp: number; feels_like: number; temp_min: number; temp_max: number};
        weather: Array<{description: string}>;
      };

      return {
        location: data.name,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        description: data.weather?.[0]?.description ?? "",
      };
    }, "Weather");

    cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  } catch (err) {
    // API 실패 시 이전 캐시 데이터 반환
    const stale = cache.getStale<WeatherResult>(cacheKey);
    if (stale) {
      logger.warn("날씨 API 실패 → 이전 캐시 데이터 반환");
      return stale;
    }
    throw err;
  }
}
