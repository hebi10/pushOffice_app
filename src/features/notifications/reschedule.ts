/**
 * 반복 일정 재스케줄링 – 앱 실행(Home 진입) 시 호출
 */
import { getNextOccurrence } from '../../lib/time';
import { getSchedulesByUser, updateSchedule } from '../schedules/scheduleService';
import { cancelNotification, scheduleNotification } from './scheduler';

/** 반복 일정 재스케줄링 */
export async function rescheduleOverdueRepeating(userId: string): Promise<void> {
  try {
    const schedules = await getSchedulesByUser(userId);
    const now = new Date();

    for (const schedule of schedules) {
      if (schedule.repeatType === 'none') continue;
      if (!schedule.notificationEnabled) continue;
      const startAt = schedule.startAt?.toDate?.();
      if (!startAt || startAt > now) continue;

      const nextDate = getNextOccurrence(startAt, schedule.repeatType, now);

      if (schedule.notificationId) {
        try {
          await cancelNotification(schedule.notificationId);
        } catch {
          /* 이미 실행/취소된 알림 */
        }
      }

      try {
        const newId = await scheduleNotification(
          schedule.title,
          `반복 일정: ${schedule.title}`,
          nextDate,
          { route: `/schedule/${schedule.id}` },
        );
        if (schedule.id) {
          await updateSchedule(schedule.id, { notificationId: newId });
        }
      } catch {
        // 알림 실패해도 계속
      }
    }
  } catch (e) {
    console.warn('[Reschedule] 실패:', e);
  }
}
