import { useEffect } from 'react';
import { clearUser, setLoading, setUser } from '../../store/slices/authSlice';
import { updateSettings } from '../../store/slices/settingsSlice';
import { useAppDispatch } from '../../store/store';
import { ensureUserDoc, getUserDoc, signInAnon, subscribeAuth } from './authService';

/** 앱 시작 시 Auth 초기화 훅 */
export function useAuthInit() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setLoading(true));

    const unsubscribe = subscribeAuth(async (user) => {
      if (user) {
        dispatch(setUser({ uid: user.uid, isAnonymous: user.isAnonymous }));
        await ensureUserDoc(user.uid);

        // Firestore에서 설정 가져와서 Redux에 반영
        const userDoc = await getUserDoc(user.uid);
        if (userDoc) {
          dispatch(
            updateSettings({
              timezone: userDoc.timezone,
              pushEnabled: userDoc.pushEnabled,
              dailyBriefingEnabled: userDoc.dailyBriefingEnabled,
              dailyBriefingTime: userDoc.dailyBriefingTime,
            }),
          );
        }
      } else {
        // 인증 상태 없으면 익명 로그인
        try {
          await signInAnon();
        } catch (error) {
          console.error('익명 로그인 실패:', error);
          dispatch(clearUser());
        }
      }
    });

    return () => unsubscribe();
  }, [dispatch]);
}
