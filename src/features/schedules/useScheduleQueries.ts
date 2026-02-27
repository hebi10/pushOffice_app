/**
 * 일정 관련 TanStack Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '../../store/store';
import type { ScheduleDoc } from '../../types';
import {
    createSchedule,
    CreateScheduleInput,
    deleteSchedule,
    getSchedule,
    getSchedulesByRange,
    getSchedulesByUser,
    updateSchedule,
} from './scheduleService';

const QUERY_KEY = 'schedules';

/** 유저 전체 일정 */
export function useSchedules() {
  const uid = useAppSelector((s) => s.auth.uid);

  return useQuery<ScheduleDoc[]>({
    queryKey: [QUERY_KEY, uid],
    queryFn: () => (uid ? getSchedulesByUser(uid) : Promise.resolve([])),
    enabled: !!uid,
  });
}

/** 월간 일정 */
export function useMonthSchedules(year: number, month: number) {
  const uid = useAppSelector((s) => s.auth.uid);
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59);

  return useQuery<ScheduleDoc[]>({
    queryKey: [QUERY_KEY, 'month', uid, year, month],
    queryFn: () => (uid ? getSchedulesByRange(uid, start, end) : Promise.resolve([])),
    enabled: !!uid,
  });
}

/** 일정 단건 */
export function useScheduleDetail(id: string | undefined) {
  return useQuery<ScheduleDoc | null>({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: () => (id ? getSchedule(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

/** 일정 생성 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScheduleInput) => createSchedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** 일정 업데이트 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<ScheduleDoc, 'id' | 'createdAt'>> }) =>
      updateSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** 일정 삭제 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
