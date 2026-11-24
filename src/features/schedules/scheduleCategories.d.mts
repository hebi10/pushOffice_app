export type ScheduleCategory = 'work' | 'personal' | 'family' | 'health' | 'study' | 'other';
export declare const SCHEDULE_CATEGORIES: ReadonlyArray<Readonly<{id: ScheduleCategory | null; label: string}>>;
export declare function normalizeScheduleCategory(value: unknown): ScheduleCategory | null;
export declare function scheduleCategoryLabel(value: unknown): string;
