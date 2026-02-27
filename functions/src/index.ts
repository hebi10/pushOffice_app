/**
 * Firebase Cloud Functions – parseSchedule endpoint
 *
 * OpenAI API를 프록시하여 자연어 일정 파싱 수행
 */
import cors from 'cors';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import OpenAI from 'openai';

admin.initializeApp();

const corsHandler = cors({ origin: true });

interface ParseRequest {
  text: string;
  timezone: string;
  nowISO: string;
}

interface ParseResponse {
  title: string;
  startAtISO: string;
  repeatType: 'none' | 'monthly' | 'yearly';
  followUpQuestions: string[];
  missingFields: string[];
}

const SYSTEM_PROMPT = `당신은 한국어 자연어 일정 파서입니다. 사용자 입력에서 일정 정보를 추출하세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{
  "title": "일정 제목",
  "startAtISO": "ISO 8601 날짜/시간 문자열",
  "repeatType": "none" | "monthly" | "yearly",
  "followUpQuestions": ["추가 질문1", ...],
  "missingFields": ["누락필드명", ...]
}

규칙:
1. title: 일정 내용을 간결하게 추출
2. startAtISO: 날짜/시간을 ISO 문자열로 변환. 시간이 없으면 09:00 기본.
3. repeatType: "매달", "매월" → "monthly" / "매년", "매해" → "yearly" / 없으면 "none"
4. followUpQuestions: 정보가 부족하면 최대 3개의 후속 질문 (한국어)
5. missingFields: 누락된 필드명 배열 ("title", "date", "time" 중)
6. 현재 시각과 타임존을 기준으로 상대적 날짜(오늘, 내일, 모레 등)를 해석하세요.`;

export const parseSchedule = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { text, timezone, nowISO } = req.body as ParseRequest;

      if (!text) {
        res.status(400).json({ error: 'text field is required' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      const openai = new OpenAI({ apiKey });

      const userMessage = `현재 시각: ${nowISO}\n타임존: ${timezone}\n\n사용자 입력: "${text}"`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        res.status(500).json({ error: 'No response from AI' });
        return;
      }

      const parsed: ParseResponse = JSON.parse(content);

      // 기본값 보정
      if (!parsed.followUpQuestions) parsed.followUpQuestions = [];
      if (!parsed.missingFields) parsed.missingFields = [];
      if (!parsed.repeatType) parsed.repeatType = 'none';

      res.status(200).json(parsed);
    } catch (error: any) {
      console.error('parseSchedule error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message ?? String(error),
      });
    }
  });
});
