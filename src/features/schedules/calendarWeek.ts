/** Civil-date helpers use local dates (not fixed 24h milliseconds) across DST and month boundaries. */
export function civilDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function parseCivilDate(value: string): Date {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('날짜를 확인해 주세요.');
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12);
  if (civilDateKey(date)!==value) throw new RangeError('날짜를 확인해 주세요.');
  return date;
}
export function shiftCivilDate(value: string, days: number): string {
  const date=parseCivilDate(value); date.setDate(date.getDate()+days); return civilDateKey(date);
}
export function weekDateKeys(value: string): string[] {
  const date=parseCivilDate(value);
  const first=shiftCivilDate(value,-date.getDay());
  return Array.from({length:7},(_,i)=>shiftCivilDate(first,i));
}
export function weekBounds(value: string): {start: Date; end: Date} {
  const days=weekDateKeys(value);
  const start=parseCivilDate(days[0]); start.setHours(0,0,0,0);
  const end=parseCivilDate(days[6]); end.setHours(23,59,59,999);
  return {start,end};
}
