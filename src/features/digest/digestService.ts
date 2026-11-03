/**
 * Digest(브리핑) 생성/조회 서비스
 * 기본은 로컬 일정 요약. 명시적 allowExternal 요청만 외부 서비스를 호출합니다.
 */
import { getSchedulesByRange } from '../schedules/scheduleService';
import { ENV } from '../../lib/env';
import type { DigestDoc, DigestTypes } from '../../types';
import { getDigestAdapterByMode } from '../storage/storeAdapter';
import { generateWithLocalStore } from './digestWorkflow';

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
  /** Only an explicit user action opts into network requests. */
  allowExternal?: boolean;
}

interface GenerateDigestResponse {
  title: string;
  summary: string;
  contentMarkdown: string;
  sources: { label: string; url?: string }[];
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
  if (!input.allowExternal || !url || !Object.values(input.types).some(Boolean)) throw new Error('외부 브리핑 항목과 서비스 주소를 확인해 주세요.');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, allowExternal: undefined }),
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
  return generateWithLocalStore(input, force, {localStore:getDigestAdapterByMode('local'),getSchedules:getSchedulesByRange,external:callGenerateDigest});
}

/** 특정 날짜 digest 조회 */
export async function getDigestForDate(
  ownerId: string,
  dateKey: string,
): Promise<DigestDoc | null> {
  const adapter = getDigestAdapterByMode('local');
  return adapter.getByDate(ownerId, dateKey);
}

/** 월간 digests 조회 */
export async function getDigestsForMonth(
  ownerId: string,
  yearMonth: string,
): Promise<DigestDoc[]> {
  const adapter = getDigestAdapterByMode('local');
  return adapter.getByMonth(ownerId, yearMonth);
}
