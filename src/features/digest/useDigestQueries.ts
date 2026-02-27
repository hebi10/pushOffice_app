/**
 * Digest React Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '../../store/store';
import type { DigestDoc } from '../../types';
import {
    GenerateDigestInput,
    generateAndSaveDigest,
    getDigestForDate,
    getDigestsForMonth,
} from './digestService';

const QUERY_KEY = 'digests';

/** 월간 digests 조회 */
export function useMonthDigests(year: number, month: number) {
  const uid = useAppSelector((s) => s.auth.uid);
  const deviceKey = useAppSelector((s) => s.storageMode.deviceKey);
  const mode = useAppSelector((s) => s.storageMode.mode);
  const ownerId = mode === 'firebase' ? uid : deviceKey;
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  return useQuery<DigestDoc[]>({
    queryKey: [QUERY_KEY, 'month', ownerId, yearMonth],
    queryFn: () => (ownerId ? getDigestsForMonth(ownerId, yearMonth) : Promise.resolve([])),
    enabled: !!ownerId,
  });
}

/** 특정 날짜 digest 조회 */
export function useDateDigest(dateKey: string | undefined) {
  const uid = useAppSelector((s) => s.auth.uid);
  const deviceKey = useAppSelector((s) => s.storageMode.deviceKey);
  const mode = useAppSelector((s) => s.storageMode.mode);
  const ownerId = mode === 'firebase' ? uid : deviceKey;

  return useQuery<DigestDoc | null>({
    queryKey: [QUERY_KEY, 'date', ownerId, dateKey],
    queryFn: () =>
      ownerId && dateKey ? getDigestForDate(ownerId, dateKey) : Promise.resolve(null),
    enabled: !!ownerId && !!dateKey,
  });
}

/** 브리핑 생성 mutation */
export function useGenerateDigest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateDigestInput) => generateAndSaveDigest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
