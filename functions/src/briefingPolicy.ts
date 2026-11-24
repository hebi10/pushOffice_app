/** Validated external briefing request and conservative pilot quota. */
export type BriefingTypes = {weather: boolean; stocks: boolean; news: boolean};
export type NewsCountry = "kr" | "us";
export interface BriefingRequest {
  types: BriefingTypes;
  lat?: number;
  lon?: number;
  stockTickers?: string[];
  newsCountry?: NewsCountry;
}
export class BriefingInputError extends Error {}

const CITIES: ReadonlyArray<readonly [string, string, number, number]> = [
  ["서울", "seoul", 37.5665, 126.9780],
  ["부산", "busan", 35.1796, 129.0756],
  ["대구", "daegu", 35.8714, 128.6014],
  ["인천", "incheon", 37.4563, 126.7052],
  ["광주", "gwangju", 35.1595, 126.8526],
  ["대전", "daejeon", 36.3504, 127.3845],
  ["울산", "ulsan", 35.5384, 129.3114],
  ["세종", "sejong", 36.4800, 127.0000],
  ["제주", "jeju", 33.4996, 126.5312],
  ["수원", "suwon", 37.2636, 127.0286],
  ["창원", "changwon", 35.2281, 128.6811],
  ["고양", "goyang", 37.6584, 126.8320],
  ["용인", "yongin", 37.2411, 127.1776],
  ["성남", "seongnam", 37.4201, 127.1265],
];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BriefingInputError("요청 형식을 확인해 주세요.");
  }
  return value as Record<string, unknown>;
}
function onlyKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new BriefingInputError("지원하지 않는 요청 항목입니다.");
  }
}
export function resolveCity(value: unknown): {lat: number; lon: number} {
  const city = typeof value === "string" ? value.trim().toLowerCase() : "";
  const match = CITIES.find(([ko, en]) =>
    city === ko || city === en || city === ko + "시" ||
    (ko === "서울" && city === "서울특별시") ||
    (["부산", "대구", "인천", "광주", "대전", "울산"].includes(ko) &&
      city === ko + "광역시") ||
    (ko === "세종" && city === "세종특별자치시"));
  if (!match) throw new BriefingInputError("지원하는 날씨 도시를 입력해 주세요.");
  return {lat: match[2], lon: match[3]};
}
function ticker(value: unknown): string {
  const symbol = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(symbol)) {
    throw new BriefingInputError("주식 종목 형식을 확인해 주세요.");
  }
  return symbol;
}
export function parseDigestRequest(value: unknown): BriefingRequest {
  const body = object(value);
  onlyKeys(body, ["types", "city", "stockTickers", "newsLanguage"]);
  const flags = object(body.types);
  onlyKeys(flags, ["weather", "stocks", "news"]);
  const {weather, stocks, news} = flags;
  if (typeof weather !== "boolean" || typeof stocks !== "boolean" ||
      typeof news !== "boolean" || !(weather || stocks || news)) {
    throw new BriefingInputError("외부 정보 항목을 선택해 주세요.");
  }
  const result: BriefingRequest = {types: {weather, stocks, news}};
  if (weather) Object.assign(result, resolveCity(body.city));
  else if ("city" in body) throw new BriefingInputError("날씨가 선택되지 않았습니다.");
  if (stocks) {
    if (!Array.isArray(body.stockTickers) || body.stockTickers.length < 1 ||
        body.stockTickers.length > 5) {
      throw new BriefingInputError("주식 종목을 1~5개 선택해 주세요.");
    }
    result.stockTickers = [...new Set(body.stockTickers.map(ticker))];
  } else if ("stockTickers" in body) {
    throw new BriefingInputError("주식이 선택되지 않았습니다.");
  }
  if (news) {
    if (body.newsLanguage !== "ko" && body.newsLanguage !== "en") {
      throw new BriefingInputError("뉴스 지역은 ko 또는 en으로 설정해 주세요.");
    }
    result.newsCountry = body.newsLanguage === "ko" ? "kr" : "us";
  } else if ("newsLanguage" in body) {
    throw new BriefingInputError("뉴스가 선택되지 않았습니다.");
  }
  return result;
}
function coordinate(value: unknown, max: number): number {
  if (typeof value !== "string" || !/^-?\d{1,3}(\.\d{1,8})?$/.test(value)) {
    throw new BriefingInputError("좌표를 확인해 주세요.");
  }
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > max) {
    throw new BriefingInputError("좌표를 확인해 주세요.");
  }
  return Math.round(number * 100) / 100;
}
/** Legacy REST clients must also authenticate, and explicitly supply coordinates and symbol. */
export function parseRestRequest(value: unknown): BriefingRequest {
  const query = object(value);
  onlyKeys(query, ["lat", "lon", "symbol"]);
  return {
    types: {weather: true, news: true, stocks: true},
    lat: coordinate(query.lat, 90), lon: coordinate(query.lon, 180),
    stockTickers: [ticker(query.symbol)], newsCountry: "kr",
  };
}
export function approvedPilotUids(enabled: string | undefined, csv: string | undefined): Set<string> {
  if (enabled !== "true") return new Set();
  const uids = (csv ?? "").split(",").map((uid) => uid.trim()).filter(Boolean);
  if (uids.length === 0 || uids.length > 50 ||
      uids.some((uid) => uid.length > 128 || /\s/.test(uid))) return new Set();
  return new Set(uids);
}
export interface QuotaCounter {
  day: string; minute: number; daily: number; perMinute: number; stockCalls: number;
}
function counter(raw: unknown, day: string, minute: number): QuotaCounter {
  if (raw === undefined) return {day, minute, daily: 0, perMinute: 0, stockCalls: 0};
  const c = object(raw);
  if (typeof c.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c.day) ||
      typeof c.minute !== "number" || !Number.isSafeInteger(c.minute) ||
      [c.daily, c.perMinute, c.stockCalls].some((n) =>
        typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)) {
    throw new Error("Invalid persisted quota");
  }
  if (c.day > day || c.minute > minute) throw new Error("Quota clock regression");
  return {
    day, minute,
    daily: c.day === day ? c.daily as number : 0,
    perMinute: c.minute === minute ? c.perMinute as number : 0,
    stockCalls: c.day === day ? c.stockCalls as number : 0,
  };
}
/** Reserve worst-case provider attempts before any call. Never refund a failed call. */
export function reserveQuota(globalRaw: unknown, userRaw: unknown, now: number, stockAttempts: number):
    {global: QuotaCounter; user: QuotaCounter} | null {
  if (!Number.isSafeInteger(stockAttempts) || stockAttempts < 0 || stockAttempts > 15) {
    throw new Error("Invalid provider cost");
  }
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / 60000);
  const global = counter(globalRaw, day, minute);
  const user = counter(userRaw, day, minute);
  if (global.daily >= 12 || global.perMinute >= 3 || user.daily >= 4 ||
      user.perMinute >= 1 || global.stockCalls + stockAttempts > 24) return null;
  for (const c of [global, user]) {
    c.daily++; c.perMinute++; c.stockCalls += stockAttempts;
  }
  return {global, user};
}
