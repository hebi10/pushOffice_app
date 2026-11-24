export declare const REMINDER_OFFSETS: readonly number[];
export declare const MAX_REMINDER_OFFSETS: number;
export declare function normalizeReminderOffsets(value: unknown): number[];
export declare function normalizeCompletedAt(value: unknown): number | null;
export declare function reminderOffsetLabel(value: number): string;
export declare function toggleReminderOffset(current: number[], offset: number): number[];
