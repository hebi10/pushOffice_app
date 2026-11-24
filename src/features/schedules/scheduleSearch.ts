import { scheduleCategoryLabel, type ScheduleCategory } from './scheduleCategories.mjs';

type SearchRecord = {
  id?: string;
  title: string;
  location?: string | null;
  notes?: string | null;
  category?: ScheduleCategory | null;
  startAt: { toMillis(): number };
};
type SearchIndex<T extends SearchRecord> = { record: T; tokens: string; category: ScheduleCategory | null };
export type CategoryFilter = ScheduleCategory | 'all' | null;

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Only stored base records, not expanded recurrence instances. No network or raw notification text. */
export function buildScheduleSearchIndex<T extends SearchRecord>(records: readonly T[]): SearchIndex<T>[] {
  return records.map(record => ({
    record,
    category: record.category ?? null,
    tokens: normalize([record.title, record.location ?? '', record.notes ?? '', scheduleCategoryLabel(record.category)].join(' ')),
  })).sort((a,b) => b.record.startAt.toMillis() - a.record.startAt.toMillis()
    || (a.record.id ?? '').localeCompare(b.record.id ?? ''));
}
export function filterScheduleIndex<T extends SearchRecord>(
  index: readonly SearchIndex<T>[], query: string, category: CategoryFilter,
): T[] {
  const words = normalize(query.slice(0,120)).split(' ').filter(Boolean);
  return index.filter(entry => (category === 'all' || category === entry.category)
    && words.every(word => entry.tokens.includes(word))).map(entry => entry.record);
}
