/**
 * Digest(브리핑) 생성/조회 서비스
 * - Firebase mode: Cloud Functions 호출 → Firestore 저장
 * - Local mode: Cloud Functions 호출 → AsyncStorage 저장
 */
import { ENV } from '../../lib/env';
import type { DigestDoc, DigestTypes } from '../../types';
import { getDigestAdapter } from '../storage/storeAdapter';

export interface GenerateDigestInput {
  ownerType: 'user' | 'device';
  ownerId: string;
  dateKey: string;
  timezone: string;
  types: DigestTypes;
  city?: string;
  stockTickers?: string[];
  newsKeywords?: string[];
  newsLanguage?: string;
}

interface GenerateDigestResponse {
  title: string;
  summary: string;
  contentMarkdown: string;
  sources: Array<{ label: string; url?: string }>;
  /** 구조화된 데이터 (브리핑 카드용) */
  weatherData?: DigestDoc['weatherData'];
  newsData?: DigestDoc['newsData'];
  stockData?: DigestDoc['stockData'];
  aiBriefing?: string;
}

/** Cloud Functions의 generateDigest 호출 */
export async function callGenerateDigest(
  input: GenerateDigestInput,
): Promise<GenerateDigestResponse> {
  // Firebase Functions v2(Cloud Run)는 함수마다 독립 URL → 경로 없이 루트로 호출
  const url = ENV.FUNCTIONS_BASE_URL;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`브리핑 생성 실패 (${response.status}): ${errorText}`);
  }

  return response.json();
}

/** fallback으로 저장된 빈 데이터인지 확인 */
export function isFallbackDigest(digest: DigestDoc): boolean {
  return (
    digest.sources.length === 0 &&
    (digest.contentMarkdown.includes('데이터를 불러올 수 없습니다') ||
      digest.summary.includes('네트워크 연결을 확인하세요'))
  );
}

/** 브리핑 생성 후 저장 */
export async function generateAndSaveDigest(
  input: GenerateDigestInput,
  force = false,
): Promise<DigestDoc> {
  const adapter = await getDigestAdapter();

  // force가 아닌 경우에만 기존 데이터 재사용
  // (단, fallback 데이터이거나 types 설정이 변경된 경우 재생성)
  if (!force) {
    const existing = await adapter.getByDate(input.ownerId, input.dateKey);
    if (existing && !isFallbackDigest(existing)) {
      const typesMatch =
        existing.types.weather === input.types.weather &&
        existing.types.news === input.types.news &&
        existing.types.stocks === input.types.stocks;
      if (typesMatch) return existing;
    }
  }

  let result: GenerateDigestResponse;
  try {
    result = await callGenerateDigest(input);
  } catch {
    // fallback: 간단 기본 브리핑
    result = {
      title: '오늘 브리핑',
      summary: '브리핑 정보를 가져오지 못했습니다. 네트워크 연결을 확인하세요.',
      contentMarkdown: '## 오늘 브리핑\n\n- 데이터를 불러올 수 없습니다. 잠시 후 다시 시도하세요.',
      sources: [],
    };
  }

  const digest: DigestDoc = {
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    dateKey: input.dateKey,
    types: input.types,
    title: result.title,
    summary: result.summary,
    contentMarkdown: result.contentMarkdown,
    sources: result.sources,
    weatherData: result.weatherData ?? null,
    newsData: result.newsData ?? null,
    stockData: result.stockData ?? null,
    aiBriefing: result.aiBriefing ?? '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const id = await adapter.save(digest);
  return { ...digest, id };
}

/** 특정 날짜 digest 조회 */
export async function getDigestForDate(
  ownerId: string,
  dateKey: string,
): Promise<DigestDoc | null> {
  const adapter = await getDigestAdapter();
  return adapter.getByDate(ownerId, dateKey);
}

/** 월간 digests 조회 */
export async function getDigestsForMonth(
  ownerId: string,
  yearMonth: string,
): Promise<DigestDoc[]> {
  const adapter = await getDigestAdapter();
  return adapter.getByMonth(ownerId, yearMonth);
}
