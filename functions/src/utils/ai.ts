/**
 * AI 요약 서비스 (OpenAI)
 *
 * - 날씨 + 뉴스 + 주식 데이터를 기반으로 보고서 형식 브리핑 생성
 * - OpenAI API 키가 없으면 기본 템플릿 브리핑으로 대체
 * - 실패 시에도 기본 템플릿으로 fallback
 */
import * as logger from "firebase-functions/logger";
import { config } from "../config.js";
import { withRetry } from "./retry.js";

export interface BriefingData {
  weather?: {
    location: string;
    temperature: number;
    feelsLike: number;
    tempMin: number;
    tempMax: number;
    description: string;
  } | null;
  news?: Array<{
    title: string;
    description: string;
    source: string;
    url?: string;
    publishedAt: string;
  }> | null;
  stocks?: Array<{
    symbol: string;
    latestPrice: string;
    changePercent: string;
  }>;
}

/** OpenAI에 보낼 프롬프트 생성 – 출근 전 30초 모닝 브리핑 */
function buildPrompt(data: BriefingData): string {
  const sections: string[] = [];

  if (data.weather) {
    sections.push(
      `날씨: ${data.weather.location} ${data.weather.temperature}도` +
      ` (체감 ${data.weather.feelsLike}도, 최저 ${data.weather.tempMin}도 / 최고 ${data.weather.tempMax}도)` +
      ` ${data.weather.description}`,
    );
  }

  if (data.news && data.news.length > 0) {
    const newsText = data.news
      .slice(0, 3)
      .map((n, i) => `${i + 1}. ${n.title}`)
      .join("\n");
    sections.push(`주요 뉴스:\n${newsText}`);
  }

  if (data.stocks && data.stocks.length > 0) {
    const stockText = data.stocks
      .map((s) => `${s.symbol} $${s.latestPrice} (${s.changePercent})`)
      .join(", ");
    sections.push(`주식: ${stockText}`);
  }

  return [
    "아래 데이터를 바탕으로 출근길 모닝 브리핑을 작성하세요.",
    "",
    "규칙:",
    "- 3~5문장, 150자 이내",
    "- 순서: 날씨 → 뉴스 → 주식",
    "- 이모지 금지",
    "- 실용적이고 담백한 톤 (예: '우산 챙기세요', '외투 필요합니다')",
    "- 과장 금지, 객관적 서술",
    "",
    "데이터:",
    sections.join("\n\n"),
  ].join("\n");
}

/** OpenAI API 키 없을 때 사용하는 기본 템플릿 */
function generateFallbackBriefing(data: BriefingData): string {
  const lines: string[] = [];

  if (data.weather) {
    lines.push(
      `${data.weather.location} ${data.weather.temperature}도` +
      ` (체감 ${data.weather.feelsLike}도), ${data.weather.description}.` +
      ` 최저 ${data.weather.tempMin}도, 최고 ${data.weather.tempMax}도.`,
    );
  }

  if (data.news && data.news.length > 0) {
    lines.push(
      `주요 뉴스: ${data.news.slice(0, 2).map((n) => n.title).join(", ")}.`,
    );
  }

  if (data.stocks && data.stocks.length > 0) {
    lines.push(
      data.stocks
        .map((s) => `${s.symbol} $${s.latestPrice} (${s.changePercent})`)
        .join(", ") + ".",
    );
  }

  return lines.join(" ");
}

/** AI 요약 생성 (실패 시 기본 템플릿 반환) */
export async function generateAISummary(data: BriefingData): Promise<string> {
  if (!config.openaiApiKey) {
    logger.info("OpenAI API 키 미설정 → 기본 템플릿 브리핑 생성");
    return generateFallbackBriefing(data);
  }

  try {
    const briefing = await withRetry(async () => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "당신은 출근길 모닝 브리핑 어시스턴트입니다. " +
                "실용적이고 담백하게 핵심만 전달합니다. " +
                "150자 이내, 3~5문장으로 작성합니다.",
            },
            {role: "user", content: buildPrompt(data)},
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API 오류 (${response.status}): ${errorText}`);
      }

      const result = await response.json() as {
        choices: Array<{message: {content: string}}>;
      };
      return result.choices[0].message.content;
    }, "OpenAI");

    return briefing;
  } catch (err) {
    logger.error("AI 요약 생성 실패 → 기본 템플릿 사용", err);
    return generateFallbackBriefing(data);
  }
}
