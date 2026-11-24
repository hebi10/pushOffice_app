/**
 * Digest(브리핑) 생성/조회 서비스
 * 기본은 로컬 일정 요약. 명시적 allowExternal 요청만 외부 서비스를 호출합니다.
 */
import { getSchedulesByRange } from '../schedules/scheduleService';
import { ENV } from '../../lib/env';
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase';
import { buildExternalBriefingPayload, isTrustedBriefingEndpoint } from './externalBriefingRequest';
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
  const url = ENV.FUNCTIONS_BASE_URL.trim();
  if (!isFirebaseConfigured || !isTrustedBriefingEndpoint(url)) {
    throw new Error('외부 브리핑 서비스가 연결되지 않았습니다.');
  }
  const payload = buildExternalBriefingPayload(input);
  // Auth is restored only after explicit opt-in; no automatic account creation or sign-in.
  const auth = getFirebaseAuth();
  let token: string;
  try {
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error('No existing account');
    token = await auth.currentUser.getIdToken();
  } catch {
    throw new Error('외부 브리핑은 이용 승인된 기존 계정에서 사용할 수 있습니다.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new Error('외부 브리핑에 연결하지 못했습니다. 로컬 일정은 계속 사용할 수 있습니다.');
    }
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? '외부 브리핑 이용 승인을 확인해 주세요.'
        : response.status === 429 ? '외부 브리핑 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
        : response.status === 400 ? '외부 정보 설정을 확인해 주세요.'
        : '외부 브리핑 서비스를 이용할 수 없습니다.';
      throw new Error(message);
    }
    try {
      const value: GenerateDigestResponse = await response.json();
      if (!value || typeof value.title !== 'string' || typeof value.summary !== 'string' ||
          typeof value.contentMarkdown !== 'string' || !Array.isArray(value.sources)) throw new Error('Invalid response');
      return value;
    } catch {
      throw new Error('외부 브리핑 응답을 확인하지 못했습니다.');
    }
  } finally {
    clearTimeout(timeout);
  }
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
