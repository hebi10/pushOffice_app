/**
 * 저장소 어댑터 – storageMode에 따라 local / firebase 분기
 */
import type { DigestDoc } from '../../types';
import {
    fbGetDigestByDate,
    fbGetDigestsByMonth,
    fbGetDigestsByOwner,
    fbSaveDigest,
} from './firebaseStore';
import {
    localGetDigestByDate,
    localGetDigests,
    localGetDigestsByMonth,
    localSaveDigest,
} from './localStore';
import { getStorageMode } from './storageMode';

export interface DigestAdapter {
  getAll(ownerId: string): Promise<DigestDoc[]>;
  getByDate(ownerId: string, dateKey: string): Promise<DigestDoc | null>;
  getByMonth(ownerId: string, yearMonth: string): Promise<DigestDoc[]>;
  save(digest: DigestDoc): Promise<string>;
}

const firebaseAdapter: DigestAdapter = {
  getAll: fbGetDigestsByOwner,
  getByDate: fbGetDigestByDate,
  getByMonth: fbGetDigestsByMonth,
  save: fbSaveDigest,
};

const localAdapter: DigestAdapter = {
  getAll: localGetDigests,
  getByDate: localGetDigestByDate,
  getByMonth: localGetDigestsByMonth,
  save: localSaveDigest,
};

/** 현재 모드에 맞는 DigestAdapter 반환 */
export async function getDigestAdapter(): Promise<DigestAdapter> {
  const mode = await getStorageMode();
  return mode === 'local' ? localAdapter : firebaseAdapter;
}

/** 명시적으로 모드를 지정 */
export function getDigestAdapterByMode(mode: 'firebase' | 'local'): DigestAdapter {
  return mode === 'local' ? localAdapter : firebaseAdapter;
}
