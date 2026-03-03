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
    // useEffect 클린업에서 호출할 unsubscribe를 IIFE 바깥에 선언
    let unsubscribe: (() => void) | undefined;

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

      // unsubscribe를 IIFE 바깥 변수에 저장해야 useEffect 클린업에서 해제 가능
      unsubscribe = subscribeAuth(async (user) => {
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
          // Firebase 인증 성공 후 로딩 해제
          dispatch(setLoading(false));
        } else {
          // 인증 상태 없으면 익명 로그인 시도
          try {
            await signInAnon();
          } catch (error: any) {
            // admin-restricted-operation / operation-not-allowed:
            // Firebase 콘솔에서 익명 로그인이 비활성화된 경우 → 로컬 모드로 조용히 전환
            if (
              error?.code === 'auth/admin-restricted-operation' ||
              error?.code === 'auth/operation-not-allowed'
            ) {
              console.warn('[Auth] 익명 로그인 비활성화 → 로컬 모드로 전환합니다.');
              await setStorageMode('local');
              const key = await getOrCreateDeviceKey();
              dispatch(setMode('local'));
              dispatch(setDeviceKey(key));
              const localSettings = await localGetSettings();
              if (localSettings) dispatch(updateSettings(localSettings));
              dispatch(setLoading(false));
              if (unsubscribe) unsubscribe();
            } else {
              console.error('익명 로그인 실패:', error);
              dispatch(clearUser());
              dispatch(setLoading(false));
            }
          }
        }
      });
    })();

    // useEffect 클린업: 컴포넌트 언마운트 시 리스너 해제
    return () => {
      unsubscribe?.();
    };
  }, [dispatch]);
}
