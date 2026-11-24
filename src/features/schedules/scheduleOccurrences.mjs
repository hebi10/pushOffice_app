export const MAX_EXCLUDED_STARTS = 4096;
export function normalizeExcludedStarts(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_EXCLUDED_STARTS ||
      new Set(value).size !== value.length ||
      !value.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 253402300799999)) {
    throw new Error('제외 회차 정보가 올바르지 않습니다.');
  }
  return [...value].sort((a,b)=>a-b);
}
