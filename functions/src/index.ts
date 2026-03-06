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
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./config.js";
import { generateBriefing } from "./services/briefing.service.js";

// ─── 글로벌 옵션 ───────────────────────────────────────────
setGlobalOptions({maxInstances: 10, region: "asia-northeast3"});

// ─── Rate Limiter (인스턴스 내 메모리) ─────────────────────
const rateLimitStore = new Map<string, {count: number; resetAt: number}>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, {count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS});
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// ─── CORS 헤더 ─────────────────────────────────────────────
function setCors(
  res: {set: (key: string, value: string) => unknown},
): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ─── POST /generateDigest ──────────────────────────────────
/**
 * 앱 클라이언트가 호출하는 브리핑 생성 엔드포인트
 *
 * Body: { types?, city?, stockTickers?, newsLanguage? }
 * Response: { title, summary, contentMarkdown, sources }
 */
export const generateDigest = onRequest(
  {maxInstances: 5, timeoutSeconds: 60},
  async (req, res) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    const ip = req.ip ?? "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({error: "요청 한도 초과. 잠시 후 다시 시도하세요."});
      return;
    }

    try {
      const body = req.body as {
        types?: {weather: boolean; stocks: boolean; news: boolean};
        city?: string;
        stockTickers?: string[];
        newsLanguage?: string;
      };

      logger.info("generateDigest 요청", {
        city: body.city,
        types: body.types,
      });

      const result = await generateBriefing({
        city: body.city,
        types: body.types,
        stockTickers: body.stockTickers,
        newsLanguage: body.newsLanguage,
      });

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
      logger.error("generateDigest 오류", err);
      res.status(500).json({
        title: "오늘 브리핑",
        summary: "브리핑 생성 중 오류가 발생했습니다.",
        contentMarkdown:
          "## 오류\n\n브리핑을 생성할 수 없습니다. 잠시 후 다시 시도하세요.",
        sources: [],
      });
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
    setCors(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    const ip = req.ip ?? "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({error: "요청 한도 초과. 잠시 후 다시 시도하세요."});
      return;
    }

    try {
      const lat = parseFloat(req.query.lat as string) || 37.5665;
      const lon = parseFloat(req.query.lon as string) || 126.9780;
      const symbol = (req.query.symbol as string) || "TSLA";

      logger.info("briefing 요청", {lat, lon, symbol});

      const result = await generateBriefing({
        lat,
        lon,
        stockTickers: [symbol],
      });

      res.status(200).json(result);
    } catch (err) {
      logger.error("briefing 오류", err);
      res.status(500).json({
        error: "브리핑 생성 실패",
        message: "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
      });
    }
  },
);
