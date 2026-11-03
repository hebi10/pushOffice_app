import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '../../lib/firebase';
import { getUserTimezone } from '../../lib/time';
import type { UserDoc, UserSettings } from '../../types';

/** 익명 로그인 수행 */
export async function signInAnon(): Promise<User> {
  if (!isFirebaseConfigured) throw new Error('Firebase가 설정되지 않았습니다. 로컬 모드를 사용해 주세요.');
  const credential = await signInAnonymously(getFirebaseAuth());
  return credential.user;
}

/** Auth 상태 변경 리스너 */
export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

/** 유저 문서 생성/갱신 */
export async function ensureUserDoc(uid: string): Promise<void> {
  const ref = doc(getFirebaseDb(), 'users', uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const newUser: Record<string, any> = {
      uid,
      timezone: getUserTimezone(),
      pushEnabled: true,
      dailyBriefingEnabled: false,
      dailyBriefingTime: { hour: 8, minute: 0 },
      digestTypes: { weather: true, stocks: false, news: false },
      digestCity: 'Seoul',
      stockTickers: [],
      newsLanguage: 'ko',
      newsKeywords: [],
      expoPushTokens: [],
      digestLastSentDateKey: '',
      digestLastSentAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newUser);
  } else {
    await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
  }
}

/** 유저 문서 읽기 */
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

/** 유저 설정 업데이트 */
export async function updateUserSettings(
  uid: string,
  settings: Partial<UserSettings & Record<string, any>>,
): Promise<void> {
  const ref = doc(getFirebaseDb(), 'users', uid);
  await setDoc(ref, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}
