import * as Crypto from 'expo-crypto';
import { PushOfficeNative, isPushOfficeNativeAvailable } from '../../../modules/push-office-native';
import { store } from '../../store/store';
import { localGetSettings, withSettingsLock } from './localStore';
import { saveAssistantSettings } from './nativeSettings';
import { createLocalBackup, parseLocalBackup, type LocalBackupPayload } from './localBackupCodec.mjs';

const checksum = (text: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

function requireAndroidBackup() {
  if (!isPushOfficeNativeAvailable) {
    throw new Error('백업·복원은 Push Office Android 앱에서 사용할 수 있습니다.');
  }
}

export interface LocalBackupPreview {
  payload: LocalBackupPayload;
  newCount: number;
  existingCount: number;
}

export async function exportLocalBackup(): Promise<{ saved: boolean; count: number }> {
  requireAndroidBackup();
  const schedules = await PushOfficeNative.getSchedules();
  const settings = await withSettingsLock(async () => ({
    ...store.getState().settings,
    ...await localGetSettings(),
  }));
  const text = await createLocalBackup(schedules, settings, checksum);
  const saved = await PushOfficeNative.createLocalBackupDocument(text);
  return { saved, count: schedules.length };
}

export async function chooseLocalBackup(): Promise<LocalBackupPreview | null> {
  requireAndroidBackup();
  const text = await PushOfficeNative.pickLocalBackupDocument();
  if (text === null) return null;
  const payload = await parseLocalBackup(text, checksum);
  const existing = new Set((await PushOfficeNative.getSchedules()).map(item => item.id));
  const existingCount = payload.schedules.filter(item => existing.has(item.id)).length;
  return { payload, newCount: payload.schedules.length - existingCount, existingCount };
}

export async function restoreLocalBackup(
  preview: LocalBackupPreview,
  selection: { schedules: boolean; settings: boolean },
): Promise<{ imported: number; skipped: number; alarmsReady: boolean; settingsRestored: boolean }> {
  requireAndroidBackup();
  if (!selection.schedules && !selection.settings) {
    throw new Error('복원할 항목을 선택해 주세요.');
  }

  const previousSettings = store.getState().settings;
  let settingsAttempted = false;
  try {
    if (selection.settings) {
      settingsAttempted = true;
      await saveAssistantSettings(preview.payload.settings);
    }

    let imported = 0;
    let alarmsReady = true;
    if (selection.schedules) {
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
  } catch (error) {
    if (settingsAttempted) {
      try {
        await saveAssistantSettings(previousSettings);
      } catch {
        throw new Error('복원이 중단되었고 기존 설정을 자동으로 되돌리지 못했습니다. 설정을 확인해 주세요.');
      }
    }
    throw error;
  }
}
