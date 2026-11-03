import { useEffect } from 'react';
import { Alert } from 'react-native';
import { setLoading, setUser } from '../../store/slices/authSlice';
import { updateSettings } from '../../store/slices/settingsSlice';
import { setDeviceKey, setMode } from '../../store/slices/storageModeSlice';
import { useAppDispatch } from '../../store/store';
import { localGetSettings } from '../storage/localStore';
import { recoverLegacyData } from '../storage/legacyRecovery';
import { syncNativeSettings } from '../storage/nativeSettings';
import { bootstrapLocal } from '../storage/recoveryPolicy';
import { activateLocalStorage, getOrCreateDeviceKey } from '../storage/storageMode';
export function useAuthInit() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    let active = true;
    void bootstrapLocal({
      activate: async () => { await activateLocalStorage(); await syncNativeSettings(); }, getIdentity: getOrCreateDeviceKey, getSettings: localGetSettings,
      publish: ({identity,settings}) => {
        if (!active) return;
        // Configure hooks cannot observe defaults between identity publication and restored settings.
        dispatch(setMode('local')); dispatch(setDeviceKey(identity));
        if (settings) dispatch(updateSettings(settings));
        dispatch(setUser({uid:identity,isAnonymous:true}));
      },
      recover: recoverLegacyData,
      onRecoveryError: error => { if (active) console.warn('[Legacy recovery] 원본을 보존하며 설정에서 다시 시도할 수 있습니다.', error); },
    }).catch(error => {
      if (!active) return;
      // Do not configure native reminders with unknown defaults after a settings read failure.
      Alert.alert('기기 설정 확인', `저장된 설정을 읽지 못했습니다. 기존 알림 설정을 보존하려면 앱을 다시 열어 주세요. ${String(error)}`);
      dispatch(setLoading(true));
    });
    return () => { active = false; };
  }, [dispatch]);
}
