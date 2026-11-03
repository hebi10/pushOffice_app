import { Timestamp } from 'firebase/firestore';
import type { NativeSchedule } from '../../../modules/push-office-native';
import type { ScheduleDoc } from '../../types';
type TimestampInput = number | Date | {
    seconds: number;
    nanoseconds?: number;
} | {
    toMillis(): number;
};
export function epoch(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (value instanceof Date)
        return value.getTime();
    if (value && typeof value === 'object') {
        const input = value as Exclude<TimestampInput, number | Date>;
        if ('toMillis' in input)
            return input.toMillis();
        if ('seconds' in input)
            return input.seconds * 1000 + (input.nanoseconds ?? 0) / 1e6;
    }
    return fallback;
}
export function toNativeSchedule(value: object): NativeSchedule {
    const s = value as Partial<ScheduleDoc> & {timezone?:string};
    const anchorZone = s.anchorZone ?? s.timezone;
    return {
        ...(anchorZone ? { anchorZone } : {}),
        id: s.id ?? '', userId: s.userId ?? 'local', type: s.type ?? 'schedule', title: s.title ?? '',
        startAt: epoch(s.startAt), endAt: s.endAt == null ? null : epoch(s.endAt), isAllDay: s.isAllDay ?? false,
        repeatType: s.repeatType ?? 'none', notificationEnabled: s.notificationEnabled ?? false,
        notificationId: s.notificationId ?? null, sourceText: s.sourceText ?? '',
        createdAt: epoch(s.createdAt, Date.now()), updatedAt: epoch(s.updatedAt, Date.now()),
    };
}
export function hydrateSchedule(s: NativeSchedule): ScheduleDoc {
    return { ...s, type: s.type === 'reminder' || s.type === 'memo' ? s.type : 'schedule',
        startAt: Timestamp.fromMillis(s.startAt), endAt: s.endAt == null ? null : Timestamp.fromMillis(s.endAt),
        createdAt: Timestamp.fromMillis(s.createdAt), updatedAt: Timestamp.fromMillis(s.updatedAt) };
}
type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number };
const zoneFormats = new Map<string, Intl.DateTimeFormat>();
function zonedFields(epochMs: number, zone: string): WallTime {
    let format = zoneFormats.get(zone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
        zoneFormats.set(zone, format);
    }
    const parts = Object.fromEntries(format.formatToParts(epochMs).map(p => [p.type, p.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second), millisecond: ((epochMs % 1000) + 1000) % 1000 };
}
function wallEpoch(wall: WallTime): number {
    return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond);
}
/** Match java.time.atZone: earlier instant in overlaps; shift forward by the actual gap. */
function zonedEpoch(wall: WallTime, zone: string): number {
    const nominal = wallEpoch(wall);
    const offsets = new Set<number>();
    for (let hours = -48; hours <= 48; hours += 12) {
        const sample = nominal + hours * 3600000;
        offsets.add(wallEpoch(zonedFields(sample, zone)) - sample);
    }
    const candidates = [...offsets].map(offset => nominal - offset);
    const exact = candidates.filter(candidate => wallEpoch(zonedFields(candidate, zone)) === nominal);
    if (exact.length) return Math.min(...exact);
    // A missing wall time maps forward using the pre-transition offset, as ZonedDateTime does.
    const shifted = candidates.map(candidate => ({ candidate, delta: wallEpoch(zonedFields(candidate, zone)) - nominal })).filter(x => x.delta > 0).sort((a, b) => a.delta - b.delta);
    if (!shifted.length) throw new Error(`시간대를 변환할 수 없습니다: ${zone}`);
    return shifted[0].candidate;
}
/** Projection changes only view copies. Native canonical anchor zones remain unchanged. End is exclusive. */
export function projectOccurrences(records: NativeSchedule[], start: Date, end: Date): NativeSchedule[] {
    const result: NativeSchedule[] = [];
    const from = start.getTime();
    const until = end.getTime();
    for (const record of records) {
        if (record.repeatType === 'none') {
            if (record.startAt >= from && record.startAt < until) result.push({ ...record });
            continue;
        }
        // Only old records without zone metadata fall back to the actual device zone, never an inferred location.
        const zone = record.anchorZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        const anchor = zonedFields(record.startAt, zone);
        const first = zonedFields(from, zone);
        const last = zonedFields(until, zone);
        const firstMonth = first.year * 12 + first.month - 1;
        const lastMonth = last.year * 12 + last.month - 1;
        for (let index = firstMonth; index <= lastMonth; index++) {
            const year = Math.floor(index / 12); const month = index % 12 + 1;
            if (record.repeatType === 'yearly' && month !== anchor.month) continue;
            const day = Math.min(anchor.day, new Date(Date.UTC(year, month, 0)).getUTCDate());
            const occurrence = zonedEpoch({ ...anchor, year, month, day }, zone);
            if (occurrence >= record.startAt && occurrence >= from && occurrence < until) {
                result.push({ ...record, startAt: occurrence, endAt: record.endAt == null ? null : occurrence + record.endAt - record.startAt });
            }
        }
    }
    return result.sort((a, b) => a.startAt - b.startAt);
}

/** Next card has no view horizon: calculate one occurrence per immutable series anchor. */
export function nextOccurrence(record: NativeSchedule, now: number): NativeSchedule | null {
    if (record.startAt >= now) return { ...record };
    if (record.repeatType === 'none') return null;
    const zone = record.anchorZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const anchor = zonedFields(record.startAt, zone);
    const reference = zonedFields(now, zone);
    let monthIndex = record.repeatType === 'yearly' ? reference.year * 12 + anchor.month - 1 : reference.year * 12 + reference.month - 1;
    const step = record.repeatType === 'yearly' ? 12 : 1;
    for (;;) {
        const year = Math.floor(monthIndex / 12); const month = monthIndex % 12 + 1;
        const day = Math.min(anchor.day, new Date(Date.UTC(year, month, 0)).getUTCDate());
        const startAt = zonedEpoch({ ...anchor, year, month, day }, zone);
        if (startAt >= now) return { ...record, startAt, endAt: record.endAt == null ? null : startAt + record.endAt - record.startAt };
        monthIndex += step;
    }
}
export function nextSchedule(records: NativeSchedule[], now: number): NativeSchedule | null {
    return records.map(record => nextOccurrence(record, now)).filter((record): record is NativeSchedule => record !== null).sort((a, b) => a.startAt - b.startAt)[0] ?? null;
}
