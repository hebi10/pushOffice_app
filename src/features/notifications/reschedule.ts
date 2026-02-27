/**
 * 반복 일정 재스케줄링 – 앱 실행(Home 진입) 시 호출
 * TODO: Development Build 완료 후 아래 주석 해제
 */

// import { getNextOccurrence } from '../../lib/time';
// import { getSchedulesByUser, updateSchedule } from '../schedules/scheduleService';
// import { cancelNotification, scheduleNotification } from './scheduler';

/** 반복 일정 재스케줄링 – 비활성화 */
export async function rescheduleOverdueRepeating(_userId: string): Promise<void> {
  return;
  // TODO: Development Build 완료 후 아래 주석 해제
  // const schedules = await getSchedulesByUser(_userId);
  // const now = new Date();
  // for (const schedule of schedules) {
  //   if (schedule.repeatType === 'none') continue;
  //   if (!schedule.notificationEnabled) continue;
  //   const startAt = schedule.startAt.toDate();
  //   if (startAt > now) continue;
  //   const nextDate = getNextOccurrence(startAt, schedule.repeatType, now);
  //   if (schedule.notificationId) {
  //     try { await cancelNotification(schedule.notificationId); } catch { /* 이미 실행/취소된 알림 */ }
  //   }
  //   const newId = await scheduleNotification(schedule.title, `반복 일정: ${schedule.title}`, nextDate, { route: `/schedule/${schedule.id}` });
  //   if (schedule.id) { await updateSchedule(schedule.id, { notificationId: newId }); }
  // }
}
