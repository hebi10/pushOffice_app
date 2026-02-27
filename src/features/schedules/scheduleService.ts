/**
 * 일정 Firestore CRUD
 */
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { RepeatType, ScheduleDoc } from '../../types';

const COLLECTION = 'schedules';

export interface CreateScheduleInput {
  userId: string;
  title: string;
  startAt: Date;
  repeatType: RepeatType;
  notificationEnabled: boolean;
  notificationId: string | null;
  sourceText: string;
}

/** 일정 생성 */
export async function createSchedule(input: CreateScheduleInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    startAt: Timestamp.fromDate(input.startAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** 일정 단건 조회 */
export async function getSchedule(id: string): Promise<ScheduleDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ScheduleDoc;
}

/** 유저의 전체 일정 조회 (startAt 오름차순) */
export async function getSchedulesByUser(userId: string): Promise<ScheduleDoc[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('startAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleDoc));
}

/** 날짜 범위 일정 조회 (월간) */
export async function getSchedulesByRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<ScheduleDoc[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('startAt', '>=', Timestamp.fromDate(start)),
    where('startAt', '<=', Timestamp.fromDate(end)),
    orderBy('startAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleDoc));
}

/** 일정 업데이트 */
export async function updateSchedule(
  id: string,
  data: Partial<Omit<ScheduleDoc, 'id' | 'createdAt'>>,
): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

/** 일정 삭제 */
export async function deleteSchedule(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/** 특정 날짜의 알림 개수 확인 */
export async function countNotificationsForDate(
  userId: string,
  date: Date,
): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('startAt', '>=', Timestamp.fromDate(start)),
    where('startAt', '<=', Timestamp.fromDate(end)),
    where('notificationEnabled', '==', true),
  );
  const snap = await getDocs(q);
  return snap.size;
}
