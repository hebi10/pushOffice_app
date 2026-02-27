/**
 * 로컬 자연어 파서 – 한국어 룰 기반
 *
 * 지원 패턴:
 * - 상대일: 오늘, 내일, 모레
 * - 날짜: "10일", "3월 10일", "2026년 3월 10일"
 * - 시간: "오전 9시", "오후 3시", "9시", "9:30"
 * - 반복: "매달 25일", "매월 10일", "매년 3월 10일"
 */
import { dayjs } from '../../lib/time';
import type { ParseResult, RepeatType } from '../../types';

export function localParse(text: string, tz?: string): ParseResult {
  const now = tz ? dayjs().tz(tz) : dayjs();
  const missingFields: string[] = [];

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let hour: number | null = null;
  let minute: number | null = null;
  let repeatType: RepeatType = 'none';

  // ── 반복 감지 ──
  if (/매달|매월/.test(text)) {
    repeatType = 'monthly';
  } else if (/매년|매해/.test(text)) {
    repeatType = 'yearly';
  }

  // ── 상대일 ──
  if (/오늘/.test(text)) {
    year = now.year();
    month = now.month() + 1;
    day = now.date();
  } else if (/모레/.test(text)) {
    const d = now.add(2, 'day');
    year = d.year();
    month = d.month() + 1;
    day = d.date();
  } else if (/내일/.test(text)) {
    const d = now.add(1, 'day');
    year = d.year();
    month = d.month() + 1;
    day = d.date();
  }

  // ── 절대 날짜 ──
  // "2026년 3월 10일"
  const fullDateMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (fullDateMatch) {
    year = parseInt(fullDateMatch[1], 10);
    month = parseInt(fullDateMatch[2], 10);
    day = parseInt(fullDateMatch[3], 10);
  }

  // "3월 10일"
  if (!fullDateMatch) {
    const monthDayMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (monthDayMatch) {
      month = parseInt(monthDayMatch[1], 10);
      day = parseInt(monthDayMatch[2], 10);
      year = now.year();
      // 이미 지난 날이면 다음 해
      if (
        repeatType === 'none' &&
        dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`).isBefore(
          now,
          'day',
        )
      ) {
        year += 1;
      }
    }
  }

  // "10일" (월 생략)
  if (month === null && day === null) {
    const dayOnlyMatch = text.match(/(\d{1,2})일/);
    if (dayOnlyMatch) {
      day = parseInt(dayOnlyMatch[1], 10);
      month = now.month() + 1;
      year = now.year();
      if (repeatType === 'none' && day < now.date()) {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }
  }

  // ── 시간 ──
  // "오전/오후 N시 M분" or "오전/오후 N시"
  const korTimeMatch = text.match(/(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})?분?/);
  if (korTimeMatch) {
    let h = parseInt(korTimeMatch[2], 10);
    if (korTimeMatch[1] === '오후' && h < 12) h += 12;
    if (korTimeMatch[1] === '오전' && h === 12) h = 0;
    hour = h;
    minute = korTimeMatch[3] ? parseInt(korTimeMatch[3], 10) : 0;
  }

  // "N시 M분" or "N시" without 오전/오후
  if (hour === null) {
    const simpleTimeMatch = text.match(/(\d{1,2})시\s*(\d{1,2})?분?/);
    if (simpleTimeMatch) {
      hour = parseInt(simpleTimeMatch[1], 10);
      minute = simpleTimeMatch[2] ? parseInt(simpleTimeMatch[2], 10) : 0;
    }
  }

  // "N:N0" 형태
  if (hour === null) {
    const colonTimeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (colonTimeMatch) {
      hour = parseInt(colonTimeMatch[1], 10);
      minute = parseInt(colonTimeMatch[2], 10);
    }
  }

  // ── 제목 추출 (날짜/시간/반복 키워드 제거) ──
  let titleCandidate = text
    .replace(/(\d{4})년/g, '')
    .replace(/(\d{1,2})월/g, '')
    .replace(/(\d{1,2})일/g, '')
    .replace(/(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})?분?/g, '')
    .replace(/(\d{1,2})시\s*(\d{1,2})?분?/g, '')
    .replace(/(\d{1,2}):(\d{2})/g, '')
    .replace(/매달|매월|매년|매해/g, '')
    .replace(/오늘|내일|모레/g, '')
    .replace(/에|까지|부터/g, '')
    .trim();

  // ── 누락 필드 판별 ──
  if (!titleCandidate) missingFields.push('title');
  if (day === null) missingFields.push('date');
  if (hour === null) missingFields.push('time');

  // ── ISO 생성 ──
  let startAtISO: string | null = null;
  if (year !== null && month !== null && day !== null) {
    const h = hour ?? 9; // 기본 9시
    const m = minute ?? 0;
    const d = dayjs()
      .year(year)
      .month(month - 1)
      .date(day)
      .hour(h)
      .minute(m)
      .second(0)
      .millisecond(0);
    startAtISO = d.toISOString();
  }

  return { titleCandidate, startAtISO, repeatType, missingFields };
}
