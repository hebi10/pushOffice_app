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
    description: string;
  } | null;
  news?: Array<{
    title: string;
    description: string;
    publishedAt: string;
  }> | null;
  stock?: {
    symbol: string;
    latestPrice: string;
    changePercent: string;
  } | null;
}

/** OpenAI에 보낼 프롬프트 생성 */
function buildPrompt(data: BriefingData): string {
  const sections: string[] = [];

  if (data.weather) {
    sections.push(
      `날씨: ${data.weather.location} 기온 ${data.weather.temperature}도` +
      ` (체감 ${data.weather.feelsLike}도), ${data.weather.description}`,
    );
  }

  if (data.news && data.news.length > 0) {
    const newsText = data.news
      .map((n, i) => `${i + 1}. ${n.title}: ${n.description ?? ""}`)
      .join("\n");
    sections.push(`주요 뉴스:\n${newsText}`);
  }

  if (data.stock) {
    sections.push(
      `주식: ${data.stock.symbol} 최근가 ${data.stock.latestPrice},` +
      ` 변동률 ${data.stock.changePercent}`,
    );
  }

  return [
    "다음 데이터를 기반으로 오늘의 브리핑을 작성하세요.",
    "",
    "규칙:",
    "- 보고서 형식으로 작성",
    "- 이모지 사용 금지",
    "- 항목별로 구분 (1. 날씨 / 2. 주요 뉴스 / 3. 주식 동향)",
    "- 500자 이내",
    "- 과장 표현 금지",
    "- 객관적 서술",
    "",
    "데이터:",
    sections.join("\n\n"),
    "",
    "[오늘의 브리핑] 형식으로 작성하세요.",
  ].join("\n");
}

/** OpenAI API 키 없을 때 사용하는 기본 템플릿 */
function generateFallbackBriefing(data: BriefingData): string {
  const lines: string[] = ["[오늘의 브리핑]", ""];

  if (data.weather) {
    lines.push("1. 날씨");
    lines.push(
      `${data.weather.location} 현재 기온 ${data.weather.temperature}도` +
      ` (체감 ${data.weather.feelsLike}도), ${data.weather.description}.`,
    );
    lines.push("");
  }

  if (data.news && data.news.length > 0) {
    lines.push("2. 주요 뉴스");
    data.news.forEach((n, i) => {
      lines.push(`${i + 1}) ${n.title}`);
    });
    lines.push("");
  }

  if (data.stock) {
    lines.push("3. 주식 동향");
    lines.push(
      `${data.stock.symbol}: 최근가 ${data.stock.latestPrice}` +
      ` (${data.stock.changePercent})`,
    );
  }

  return lines.join("\n");
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
                "당신은 전문적인 한국어 브리핑 어시스턴트입니다. " +
                "객관적이고 간결하게 정보를 전달합니다.",
            },
            {role: "user", content: buildPrompt(data)},
          ],
          max_tokens: 600,
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
