export const REMINDER_OFFSETS = Object.freeze([0, 5, 10, 15, 30, 60, 120, 1440]);
export const MAX_REMINDER_OFFSETS = 4;
export function normalizeReminderOffsets(value) {
  if (value === undefined) return [0];
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REMINDER_OFFSETS ||
      new Set(value).size !== value.length || !value.every(x => REMINDER_OFFSETS.includes(x))) {
    throw new Error('알림 시점을 1~4개 선택해 주세요.');
  }
  return [...value].sort((a,b) => a-b);
}
export function normalizeCompletedAt(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 253402300799999) throw new Error('완료 시각을 확인해 주세요.');
  return value;
}
export function reminderOffsetLabel(value) {
  return value === 0 ? '시작 시간' : value === 1440 ? '1일 전' : value === 120 ? '2시간 전' :
    value === 60 ? '1시간 전' : value + '분 전';
}
export function toggleReminderOffset(current, offset) {
  const values = normalizeReminderOffsets(current);
  if (!REMINDER_OFFSETS.includes(offset)) return values;
  if (values.includes(offset)) return values.length === 1 ? values : values.filter(v => v !== offset);
  return values.length >= MAX_REMINDER_OFFSETS ? values : normalizeReminderOffsets([...values, offset]);
}
