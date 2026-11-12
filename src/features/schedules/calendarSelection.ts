/** Keep the calendar's selected day when changing months, clamping short months safely. */
export function retainSelectedDayInMonth(selected: string, year: number, month: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('올바른 연도와 월이 필요합니다.');
  }
  const original = Number(selected.slice(8, 10));
  const safeDay = Number.isInteger(original) && original >= 1 && original <= 31 ? original : 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(safeDay, lastDay)).padStart(2, '0')}`;
}
