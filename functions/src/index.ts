/**
 * Firebase Cloud Functions – 브리핑 백엔드
 *
 * 엔드포인트:
 *   POST /generateDigest  – 앱 클라이언트용 (날씨+뉴스+주식 AI 브리핑)
 *   GET  /briefing         – REST API 형식 (lat/lon 쿼리)
 */
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {parseDigestRequest, parseRestRequest, BriefingInputError} from "./briefingPolicy.js";
import {admitBriefing, BriefingAccessError} from "./briefingAdmission.js";
import { generateBriefing } from "./services/briefing.service.js";

// ─── 글로벌 옵션 ───────────────────────────────────────────
setGlobalOptions({maxInstances: 10, region: "asia-northeast3"});

// Native app uses HTTPS and a Firebase ID token; do not enable wildcard browser CORS.
function errorResponse(error: unknown): {status: number; message: string} {
  if (error instanceof BriefingAccessError) return {status: error.status, message: error.message};
  if (error instanceof BriefingInputError) return {status: 400, message: error.message};
  logger.error("외부 브리핑 처리 실패");
  return {status: 503, message: "외부 브리핑을 처리하지 못했습니다."};
}

// ─── POST /generateDigest ──────────────────────────────────
/**
 * 앱 클라이언트가 호출하는 브리핑 생성 엔드포인트
 *
 * Body: { types, city?, stockTickers?, newsLanguage? }; selected fields only.
 * Response: { title, summary, contentMarkdown, sources }
 */
export const generateDigest = onRequest(
  {maxInstances: 5, timeoutSeconds: 60},
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }
    if (!req.is("application/json") || !req.rawBody || req.rawBody.length > 4096) {
      res.status(400).json({error: "요청 형식 또는 크기를 확인해 주세요."});
      return;
    }
    try {
      const input = parseDigestRequest(req.body);
      await admitBriefing(req.get("authorization"), input);
      const result = await generateBriefing(input);

      // 클라이언트 기대 형식 (DigestService 호환)
      const sources: Array<{label: string; url?: string}> = [];
      if (result.weather) {
        sources.push({label: `날씨: ${result.weather.location}`});
      }
      if (result.news) {
        sources.push({label: "뉴스", url: "https://newsapi.org"});
      }
      if (result.stock) {
        sources.push({label: `주식: ${result.stock.symbol}`});
      }

      // 구조화된 데이터 (브리핑 카드용)
      const weatherData = result.weather
        ? {
            temp: result.weather.temperature,
            feelsLike: result.weather.feelsLike,
            tempMin: result.weather.tempMin,
            tempMax: result.weather.tempMax,
            description: result.weather.description,
            city: result.weather.location,
            comment: "",
          }
        : null;

      const newsData = result.news
        ? result.news.map((n) => ({
            title: n.title,
            description: n.description,
            source: n.source,
            url: n.url,
          }))
        : null;

      const stockData = result.stocks.length > 0
        ? result.stocks.map((s) => ({
            symbol: s.symbol,
            price: s.latestPrice,
            changePercent: s.changePercent,
          }))
        : null;

      res.status(200).json({
        title: "오늘의 브리핑",
        summary:
          result.briefingText.length > 100
            ? result.briefingText.slice(0, 100) + "..."
            : result.briefingText,
        contentMarkdown: result.briefingText,
        sources,
        weatherData,
        newsData,
        stockData,
        aiBriefing: result.briefingText,
      });
    } catch (err) {
      const failure = errorResponse(err);
      res.status(failure.status).json({error: failure.message});
    }
  },
);

// ─── GET /briefing ─────────────────────────────────────────
/**
 * REST API 형식 브리핑 엔드포인트
 *
 * Query: ?lat=37.5665&lon=126.9780&symbol=TSLA
 * Response: { generatedAt, briefingText, weather, news, stock }
 */
export const briefing = onRequest(
  {maxInstances: 5, timeoutSeconds: 60},
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "GET") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }
    try {
      const input = parseRestRequest(req.query);
      await admitBriefing(req.get("authorization"), input);
      const result = await generateBriefing(input);
      res.status(200).json(result);
    } catch (err) {
      const failure = errorResponse(err);
      res.status(failure.status).json({error: failure.message});
    }
  },
);
