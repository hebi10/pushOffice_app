import { Timestamp } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { PushOfficeNative, isPushOfficeNativeAvailable, type ScheduleSyncResult } from '../../../modules/push-office-native';
import type { RepeatType, ScheduleDoc } from '../../types';
import { localCreateSchedule, localUpdateSchedule, localDeleteSchedule } from '../storage/localStore';
import { getDeviceSchedules } from '../storage/nativeStore';
import { hydrateSchedule, projectOccurrences, toNativeSchedule } from './scheduleCodec';
import { normalizeScheduleExtras } from './scheduleExtras';
import type { ScheduleCategory } from './scheduleCategories.mjs';
import { showNotice } from '../../components/ui/toast';
export interface CreateScheduleInput {
    userId: string;
    title: string;
    startAt: Date;
    endAt?: Date | null;
    location?: string | null;
    meetingUrl?: string | null;
    notes?: string | null;
    category?: ScheduleCategory | null;
    reminderOffsets?: number[];
    isAllDay?: boolean;
    repeatType: RepeatType;
    notificationEnabled: boolean;
    notificationId: string | null;
    sourceText: string;
    type?: 'schedule' | 'reminder' | 'memo';
}
export async function createSchedule(input: CreateScheduleInput): Promise<string> {
    if (!input.title.trim() || !Number.isFinite(input.startAt.getTime()))
        throw new Error('제목과 날짜를 확인해 주세요.');
    if (input.endAt && input.endAt <= input.startAt)
        throw new Error('종료 시간은 시작 시간 이후여야 합니다.');
    const id = Crypto.randomUUID();
    const record = toNativeSchedule({ ...input, ...normalizeScheduleExtras(input), anchorZone: Intl.DateTimeFormat().resolvedOptions().timeZone, id, title: input.title.trim(), createdAt: Date.now(), updatedAt: Date.now() });
    if (isPushOfficeNativeAvailable) {
        const result = await PushOfficeNative.saveSchedule(record);
        if (!result.alarmsReady || !result.widgetsReady) showNotice("일정 저장 완료", "일정은 저장했습니다. 설정에서 알림 예약 및 위젯을 다시 확인해 주세요.");
    } else {
        await localCreateSchedule(hydrateSchedule(record));
    }
    return id;
}
export async function getSchedule(id: string): Promise<ScheduleDoc | null> {
    return (await getDeviceSchedules()).find(s => s.id === id) ?? null;
}
export async function getSchedulesByUser(_userId: string): Promise<ScheduleDoc[]> {
    return (await getDeviceSchedules()).sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
}
export async function getSchedulesByRange(userId: string, start: Date, end: Date): Promise<ScheduleDoc[]> {
    return projectOccurrences((await getSchedulesByUser(userId)).map(toNativeSchedule), start, new Date(end.getTime() + 1)).map(hydrateSchedule);
}
export async function updateSchedule(id: string, data: Partial<Omit<ScheduleDoc, 'id' | 'createdAt'>>): Promise<ScheduleSyncResult> {
    const existing = await getSchedule(id);
    if (!existing)
        throw new Error('일정을 찾을 수 없습니다.');
    const record = toNativeSchedule({ ...existing, ...data, ...normalizeScheduleExtras({ ...existing, ...data }), id, updatedAt: Timestamp.now() });
    if (!record.title.trim() || record.endAt != null && record.endAt <= record.startAt)
        throw new Error('제목과 시작·종료 시간을 확인해 주세요.');
    if (isPushOfficeNativeAvailable) {
        const { alarmsReady, widgetsReady } = await PushOfficeNative.saveSchedule(record);
        return { alarmsReady, widgetsReady };
    }
    await localUpdateSchedule(id, hydrateSchedule(record));
    return { alarmsReady: true, widgetsReady: true };
}
export async function setScheduleCompleted(id: string, completed: boolean): Promise<ScheduleSyncResult> {
    if (isPushOfficeNativeAvailable) return PushOfficeNative.setScheduleCompleted(id, completed);
    const existing = await getSchedule(id);
    if (!existing) throw new Error('일정을 찾을 수 없습니다.');
    await localUpdateSchedule(id, { completedAt: completed ? existing.completedAt ?? Date.now() : null });
    return { alarmsReady: true, widgetsReady: true };
}
export async function deleteSchedule(id: string): Promise<ScheduleSyncResult> {
    if (isPushOfficeNativeAvailable) return PushOfficeNative.deleteSchedule(id);
    await localDeleteSchedule(id);
    return { alarmsReady: true, widgetsReady: true };
}
export async function countNotificationsForDate(userId: string, date: Date): Promise<number> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return (await getSchedulesByRange(userId, start, end)).filter(s => s.notificationEnabled).length;
}
export async function getSchedulesByTitle(userId: string, title: string, excludeId?: string): Promise<ScheduleDoc[]> {
    return (await getSchedulesByUser(userId)).filter(s => s.id !== excludeId && s.title === title);
}
