/** Explicit stable categories; never infer a private classification from text. */
export const SCHEDULE_CATEGORIES = Object.freeze([
  Object.freeze({ id: null, label: '미분류' }),
  Object.freeze({ id: 'work', label: '업무' }),
  Object.freeze({ id: 'personal', label: '개인' }),
  Object.freeze({ id: 'family', label: '가족' }),
  Object.freeze({ id: 'health', label: '건강' }),
  Object.freeze({ id: 'study', label: '학습' }),
  Object.freeze({ id: 'other', label: '기타' }),
]);
export function normalizeScheduleCategory(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !SCHEDULE_CATEGORIES.some(item => item.id === value)) {
    throw new Error('일정 카테고리를 확인해 주세요.');
  }
  return value;
}
export function scheduleCategoryLabel(value) {
  return SCHEDULE_CATEGORIES.find(item => item.id === (value ?? null))?.label ?? '미분류';
}
