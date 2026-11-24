import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushOfficeNative, isPushOfficeNativeAvailable } from '../../../modules/push-office-native';
import { store } from '../../store/store';
import { localGetSettings, withSettingsLock } from './localStore';
import { withBackupSettingsRestore } from './nativeSettings';
import { createLocalBackup, parseLocalBackup, type LocalBackupPayload } from './localBackupCodec.mjs';
import { isEncryptedBackup, validateBackupPassword, recordSuccessfulBackup, readBackupHistory,
  type BackupMode, type BackupHistory } from './backupFlow';

const checksum = (text: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const HISTORY_KEY = '@pushoffice/last-local-backup-v1';

function requireAndroidBackup() {
  if (!isPushOfficeNativeAvailable) {
    throw new Error('백업·복원은 Push Office Android 앱에서 사용할 수 있습니다.');
  }
}

export interface LocalBackupPreview {
  payload: LocalBackupPayload;
  newCount: number;
  existingCount: number;
  mode: BackupMode;
}
export type ChosenBackup = { kind: 'encrypted'; text: string } | { kind: 'preview'; preview: LocalBackupPreview };

export async function getLastLocalBackup(): Promise<BackupHistory | null> {
  return readBackupHistory(await AsyncStorage.getItem(HISTORY_KEY));
}

export async function exportLocalBackup(password?: string) {
  requireAndroidBackup();
  const mode: BackupMode = password === undefined ? 'plain' : 'encrypted';
  if (password !== undefined) validateBackupPassword(password);
  const schedules = await PushOfficeNative.getSchedules();
  const settings = await withSettingsLock(async () => ({
    ...store.getState().settings,
    ...await localGetSettings(),
  }));
  const plain = await createLocalBackup(schedules, settings, checksum);
  const text = password === undefined ? plain : await PushOfficeNative.encryptLocalBackup(plain, password);
  const saved = await PushOfficeNative.createLocalBackupDocument(text);
  const history = await recordSuccessfulBackup(saved, mode,
    value => AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(value)));
  return { saved, count: schedules.length, mode, ...history };
}

async function previewLocalBackup(text: string, mode: BackupMode): Promise<LocalBackupPreview> {
  const payload = await parseLocalBackup(text, checksum);
  const existing = new Set((await PushOfficeNative.getSchedules()).map(item => item.id));
  const existingCount = payload.schedules.filter(item => existing.has(item.id)).length;
  return { payload, newCount: payload.schedules.length - existingCount, existingCount, mode };
}

export async function chooseLocalBackup(): Promise<ChosenBackup | null> {
  requireAndroidBackup();
  const text = await PushOfficeNative.pickLocalBackupDocument();
  if (text === null) return null;
  if (isEncryptedBackup(text)) return {kind: 'encrypted', text};
  return {kind: 'preview', preview: await previewLocalBackup(text, 'plain')};
}

export async function unlockLocalBackup(text: string, password: string): Promise<LocalBackupPreview> {
  requireAndroidBackup();
  if (!isEncryptedBackup(text)) throw new Error('암호화 백업 파일을 선택해 주세요.');
  validateBackupPassword(password);
  const plain = await PushOfficeNative.decryptLocalBackup(text, password);
  return previewLocalBackup(plain, 'encrypted');
}

export async function restoreLocalBackup(
  preview: LocalBackupPreview,
  selection: { schedules: boolean; settings: boolean },
): Promise<{ imported: number; skipped: number; alarmsReady: boolean; settingsRestored: boolean }> {
  requireAndroidBackup();
  if (!selection.schedules && !selection.settings) {
    throw new Error('복원할 항목을 선택해 주세요.');
  }

  const restore = async () => {
    let imported = 0;
    let alarmsReady = true;
    if (selection.schedules) {
      // Re-evaluate duplicates at restore time; native transaction also never overwrites IDs.
      const existing = new Set((await PushOfficeNative.getSchedules()).map(item => item.id));
      const missing = preview.payload.schedules.filter(item => !existing.has(item.id));
      const result = await PushOfficeNative.importBackupSchedules(missing);
      imported = result.imported;
      alarmsReady = result.alarmsReady;
    }
    return {
      imported,
      skipped: selection.schedules ? preview.payload.schedules.length - imported : 0,
      alarmsReady,
      settingsRestored: selection.settings,
    };
  };
  return selection.settings ? withBackupSettingsRestore(preview.payload.settings, restore) : restore();
}
