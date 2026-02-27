/**
 * 로컬 저장소 (AsyncStorage) – schedules, digests, settings CRUD
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DigestDoc, ScheduleDoc, UserSettings } from '../../types';

// ── Keys ──
const SCHEDULES_KEY = '@pushoffice/schedules';
const DIGESTS_KEY = '@pushoffice/digests';
const SETTINGS_KEY = '@pushoffice/settings';

// ── Generic helpers ──
async function readList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function writeList<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// ═══════════ Schedules ═══════════

export async function localGetSchedules(ownerId: string): Promise<ScheduleDoc[]> {
  const all = await readList<ScheduleDoc>(SCHEDULES_KEY);
  return all.filter((s) => s.userId === ownerId);
}

export async function localGetSchedulesByRange(
  ownerId: string,
  startMs: number,
  endMs: number,
): Promise<ScheduleDoc[]> {
  const all = await localGetSchedules(ownerId);
  return all.filter((s) => {
    const ms = typeof s.startAt === 'number' ? s.startAt : (s.startAt as any)?.seconds ? (s.startAt as any).seconds * 1000 : 0;
    return ms >= startMs && ms <= endMs;
  });
}

export async function localGetSchedule(id: string): Promise<ScheduleDoc | null> {
  const all = await readList<ScheduleDoc>(SCHEDULES_KEY);
  return all.find((s) => s.id === id) ?? null;
}

export async function localCreateSchedule(schedule: ScheduleDoc): Promise<string> {
  const all = await readList<ScheduleDoc>(SCHEDULES_KEY);
  const id = schedule.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  all.push({ ...schedule, id });
  await writeList(SCHEDULES_KEY, all);
  return id;
}

export async function localUpdateSchedule(
  id: string,
  data: Partial<ScheduleDoc>,
): Promise<void> {
  const all = await readList<ScheduleDoc>(SCHEDULES_KEY);
  const idx = all.findIndex((s) => s.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data, updatedAt: Date.now() as any };
    await writeList(SCHEDULES_KEY, all);
  }
}

export async function localDeleteSchedule(id: string): Promise<void> {
  const all = await readList<ScheduleDoc>(SCHEDULES_KEY);
  await writeList(SCHEDULES_KEY, all.filter((s) => s.id !== id));
}

// ═══════════ Digests ═══════════

export async function localGetDigests(ownerId: string): Promise<DigestDoc[]> {
  const all = await readList<DigestDoc>(DIGESTS_KEY);
  return all.filter((d) => d.ownerId === ownerId);
}

export async function localGetDigestByDate(
  ownerId: string,
  dateKey: string,
): Promise<DigestDoc | null> {
  const all = await localGetDigests(ownerId);
  return all.find((d) => d.dateKey === dateKey) ?? null;
}

export async function localGetDigestsByMonth(
  ownerId: string,
  yearMonth: string, // 'YYYY-MM'
): Promise<DigestDoc[]> {
  const all = await localGetDigests(ownerId);
  return all.filter((d) => d.dateKey.startsWith(yearMonth));
}

export async function localSaveDigest(digest: DigestDoc): Promise<string> {
  const all = await readList<DigestDoc>(DIGESTS_KEY);
  const id = digest.id || `digest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // 같은 ownerId + dateKey가 있으면 덮어쓰기
  const existing = all.findIndex(
    (d) => d.ownerId === digest.ownerId && d.dateKey === digest.dateKey,
  );
  const doc = { ...digest, id, updatedAt: Date.now() };
  if (existing >= 0) {
    all[existing] = doc;
  } else {
    all.push({ ...doc, createdAt: Date.now() });
  }
  await writeList(DIGESTS_KEY, all);
  return id;
}

// ═══════════ Settings ═══════════

export async function localGetSettings(): Promise<Partial<UserSettings> | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function localSaveSettings(settings: Partial<UserSettings>): Promise<void> {
  const existing = await localGetSettings();
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...settings }));
}

// ═══════════ Migration helpers ═══════════

export async function localGetAllSchedules(): Promise<ScheduleDoc[]> {
  return readList<ScheduleDoc>(SCHEDULES_KEY);
}

export async function localGetAllDigests(): Promise<DigestDoc[]> {
  return readList<DigestDoc>(DIGESTS_KEY);
}
