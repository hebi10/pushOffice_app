/**
 * Firebase 저장소 – Firestore 기반 Digests CRUD
 * (schedules는 기존 scheduleService 유지, 여기서는 digests만)
 */
import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { DigestDoc } from '../../types';

const DIGESTS_COL = 'digests';

/** 특정 사용자의 digests 조회 (dateKey 범위) */
export async function fbGetDigestsByOwner(ownerId: string): Promise<DigestDoc[]> {
  const q = query(
    collection(db, DIGESTS_COL),
    where('ownerId', '==', ownerId),
    orderBy('dateKey', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DigestDoc));
}

/** 특정 날짜 digest 조회 */
export async function fbGetDigestByDate(
  ownerId: string,
  dateKey: string,
): Promise<DigestDoc | null> {
  const q = query(
    collection(db, DIGESTS_COL),
    where('ownerId', '==', ownerId),
    where('dateKey', '==', dateKey),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DigestDoc;
}

/** 월간 digests 조회 */
export async function fbGetDigestsByMonth(
  ownerId: string,
  yearMonth: string,
): Promise<DigestDoc[]> {
  const startKey = `${yearMonth}-01`;
  const endKey = `${yearMonth}-31`;
  const q = query(
    collection(db, DIGESTS_COL),
    where('ownerId', '==', ownerId),
    where('dateKey', '>=', startKey),
    where('dateKey', '<=', endKey),
    orderBy('dateKey', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DigestDoc));
}

/** Digest 저장 (upsert by ownerId+dateKey) */
export async function fbSaveDigest(digest: DigestDoc): Promise<string> {
  // 기존 문서 확인
  const existing = await fbGetDigestByDate(digest.ownerId, digest.dateKey);
  if (existing?.id) {
    const ref = doc(db, DIGESTS_COL, existing.id);
    await setDoc(ref, { ...digest, updatedAt: serverTimestamp() }, { merge: true });
    return existing.id;
  }
  const ref = await addDoc(collection(db, DIGESTS_COL), {
    ...digest,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
