import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '../../lib/firebase';
import type { ScheduleDoc } from '../../types';
import { importLegacyRecords, finishLegacyNotificationCleanup } from './nativeStore';
import { recoverLegacySources, type LegacyCloudState } from './recoveryPolicy';
import { commitRecoveredSettings, legacySettingsRecovered, syncNativeSettings } from './nativeSettings';
import { recoverSchedulingSettings } from './settingsRecoveryPolicy';
import { getLegacyCloudState, saveLegacyCloudState } from './storageMode';
let running: Promise<LegacyCloudState | null> | undefined;
/** Read-only legacy recovery; shares one in-flight request between startup and the explicit retry action. */
export function recoverLegacyData(): Promise<LegacyCloudState | null> {
  if (!running) running = recoverLegacySources({
    importLocal: () => importLegacyRecords('@pushoffice/native-local-import-v1'),
    getCloudState: getLegacyCloudState, saveCloudState: saveLegacyCloudState,
    configured: () => isFirebaseConfigured,
    settingsAlreadyRecovered: legacySettingsRecovered,
    recoverSettings: async uid => {
      if (await legacySettingsRecovered(uid)) { await syncNativeSettings(); return; }
      await recoverSchedulingSettings({
        readRemote: async () => {
          const snapshot = await getDoc(doc(getFirebaseDb(), 'users', uid));
          if (!snapshot.exists()) throw new Error('이전 계정 설정을 찾지 못했습니다.');
          return snapshot.data();
        },
        commit: remote => commitRecoveredSettings(uid, remote),
      });
    },
    cloudAlreadyImported: async uid => !!await AsyncStorage.getItem(`@pushoffice/native-cloud-import-v1/${uid}`),
    readExistingIdentity: async () => { const auth = getFirebaseAuth(); await auth.authStateReady(); return auth.currentUser?.uid ?? null; },
    importCloud: uid => importLegacyRecords(`@pushoffice/native-cloud-import-v1/${uid}`, async () => {
      const snapshot = await getDocs(query(collection(getFirebaseDb(), 'schedules'), where('userId', '==', uid)));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ScheduleDoc));
    }),
    finishCleanup: finishLegacyNotificationCleanup,
  }).finally(() => { running = undefined; });
  return running;
}
export async function retryLegacyRecovery(): Promise<LegacyCloudState | null> {
  if (!await getLegacyCloudState()) await saveLegacyCloudState({ pending: true, message: '이전에 사용하던 계정의 일정을 확인합니다. 새 계정을 생성하지 않습니다.' });
  return recoverLegacyData();
}
