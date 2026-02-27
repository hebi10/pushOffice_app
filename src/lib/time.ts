import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ko');

export { dayjs };

/** 사용자 타임존 가져오기 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 현재 시각 ISO */
export function nowISO(tz?: string): string {
  return tz ? dayjs().tz(tz).toISOString() : dayjs().toISOString();
}

/** 월의 마지막 날 보정: 예를 들어 31일->28일 */
export function clampDayToMonth(year: number, month: number, day: number): number {
  const maxDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
  return Math.min(day, maxDay);
}

/** 다음 반복 일정 계산 */
export function getNextOccurrence(
  startAt: Date,
  repeatType: 'monthly' | 'yearly',
  afterDate: Date = new Date(),
): Date {
  let next = dayjs(startAt);
  const now = dayjs(afterDate);

  if (repeatType === 'monthly') {
    while (next.isBefore(now)) {
      const nextMonth = next.month() + 1;
      const nextYear = nextMonth > 11 ? next.year() + 1 : next.year();
      const month = nextMonth > 11 ? 0 : nextMonth;
      const day = clampDayToMonth(nextYear, month + 1, next.date());
      next = next.year(nextYear).month(month).date(day);
    }
  } else {
    // yearly
    while (next.isBefore(now)) {
      const nextYear = next.year() + 1;
      const day = clampDayToMonth(nextYear, next.month() + 1, next.date());
      next = next.year(nextYear).date(day);
    }
  }

  return next.toDate();
}
