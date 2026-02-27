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
}

/** Cloud Functions의 generateDigest 호출 */
export async function callGenerateDigest(
  input: GenerateDigestInput,
): Promise<GenerateDigestResponse> {
  const url = `${ENV.FUNCTIONS_BASE_URL}/generateDigest`;

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

/** 브리핑 생성 후 저장 */
export async function generateAndSaveDigest(
  input: GenerateDigestInput,
): Promise<DigestDoc> {
  const adapter = await getDigestAdapter();

  // 이미 존재하는지 확인
  const existing = await adapter.getByDate(input.ownerId, input.dateKey);
  if (existing) return existing;

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
