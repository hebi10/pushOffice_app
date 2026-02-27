/**
 * AI 파싱 클라이언트 – Firebase Cloud Functions HTTPS 호출
 */
import { ENV } from '../../lib/env';
import type { AIParseResponse } from '../../types';

interface AIParseRequest {
  text: string;
  timezone: string;
  nowISO: string;
}

export async function aiParse(req: AIParseRequest): Promise<AIParseResponse> {
  const url = `${ENV.FUNCTIONS_BASE_URL}/parseSchedule`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 파싱 실패 (${response.status}): ${errorText}`);
  }

  const data: AIParseResponse = await response.json();
  return data;
}
