import { useEffect } from 'react';
import { clearUser, setLoading, setUser } from '../../store/slices/authSlice';
import { updateSettings } from '../../store/slices/settingsSlice';
import { setDeviceKey, setMode } from '../../store/slices/storageModeSlice';
import { useAppDispatch } from '../../store/store';
import { localGetSettings } from '../storage/localStore';
import { getOrCreateDeviceKey, getStorageMode, setStorageMode } from '../storage/storageMode';
import { ensureUserDoc, getUserDoc, signInAnon, subscribeAuth } from './authService';

/** 앱 시작 시 Auth 초기화 훅 */
export function useAuthInit() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setLoading(true));

    (async () => {
      // 저장 모드 확인
      let mode = await getStorageMode();

      if (mode === 'local') {
        dispatch(setMode('local'));
        const key = await getOrCreateDeviceKey();
        dispatch(setDeviceKey(key));

        // 로컬 설정 로드
        const localSettings = await localGetSettings();
        if (localSettings) {
          dispatch(updateSettings(localSettings));
        }
        dispatch(clearUser());
        dispatch(setLoading(false));
        return;
      }

      // firebase mode (기본)
      if (!mode) {
        mode = 'firebase';
        await setStorageMode('firebase');
      }
      dispatch(setMode('firebase'));

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
                digestTypes: userDoc.digestTypes || { weather: true, stocks: false, news: false },
                digestCity: userDoc.digestCity || 'Seoul',
                stockTickers: userDoc.stockTickers || [],
                newsLanguage: userDoc.newsLanguage || 'ko',
                newsKeywords: userDoc.newsKeywords || [],
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
    })();
  }, [dispatch]);
}
