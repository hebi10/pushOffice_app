/**
 * 로컬 알림 스케줄링
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { clampDayToMonth, dayjs } from '../../lib/time';

const MAX_DAILY_NOTIFICATIONS = 8;

/** 일정 알림 스케줄 (1회성) */
export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, unknown>,
): Promise<string> {
  const secondsUntil = Math.max(Math.floor((triggerDate.getTime() - Date.now()) / 1000), 1);
  if (secondsUntil <= 0) throw new Error('과거 시각에는 알림을 예약할 수 없습니다.');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { ...data },
      ...(Platform.OS === 'android' ? { channelId: 'schedules' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });
  return id;
}

/** 재알림: 1시간 뒤 */
export async function scheduleReminder1Hour(
  scheduleId: string,
  title: string,
): Promise<string> {
  return scheduleNotification(
    title,
    '1시간 뒤 재알림',
    new Date(Date.now() + 60 * 60 * 1000),
    { route: `/schedule/${scheduleId}` },
  );
}

/** 재알림: 내일 같은 시간 */
export async function scheduleReminderTomorrow(
  scheduleId: string,
  title: string,
  originalDate: Date,
): Promise<string> {
  const tomorrow = dayjs(originalDate).add(1, 'day').toDate();
  return scheduleNotification(
    title,
    '내일 재알림',
    tomorrow,
    { route: `/schedule/${scheduleId}` },
  );
}

/** 재알림: 다음 달 같은 날짜/시간 */
export async function scheduleReminderNextMonth(
  scheduleId: string,
  title: string,
  originalDate: Date,
): Promise<string> {
  const orig = dayjs(originalDate);
  const nextMonth = orig.month() + 1;
  const nextYear = nextMonth > 11 ? orig.year() + 1 : orig.year();
  const month = nextMonth > 11 ? 0 : nextMonth;
  const day = clampDayToMonth(nextYear, month + 1, orig.date());

  const target = orig.year(nextYear).month(month).date(day).toDate();
  return scheduleNotification(
    title,
    '다음 달 재알림',
    target,
    { route: `/schedule/${scheduleId}` },
  );
}

/** 일일 브리핑 알림 (매일 반복) */
export async function scheduleDailyBriefing(
  hour: number,
  minute: number,
): Promise<string> {
  await cancelDailyBriefing();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '오늘 브리핑',
      body: '오늘 일정과 브리핑을 확인하세요.',
      sound: 'default',
      data: { route: '/briefing' },
      ...(Platform.OS === 'android' ? { channelId: 'briefing' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
  return id;
}

/** 브리핑 알림 취소 */
export async function cancelDailyBriefing(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content.data?.route === '/briefing') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // ignore
  }
}

/** 특정 알림 취소 */
export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}

/** 현재 스케줄된 알림 개수 조회 */
export async function getScheduledNotificationCount(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}

/** 하루 알림 제한 확인 */
export async function canScheduleMore(): Promise<boolean> {
  const count = await getScheduledNotificationCount();
  return count < MAX_DAILY_NOTIFICATIONS;
}
