import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { StorageMode } from '../../types';
import { activateLocalStorage as activatePolicy, LEGACY_CLOUD_KEY, STORAGE_MODE_KEY, type LegacyCloudState } from './recoveryPolicy';
const DEVICE_KEY_KEY = '@pushoffice/deviceKey';
/** All normal app services stay local, independently of any pending read-only legacy source. */
export async function getStorageMode(): Promise<StorageMode | null> { return 'local'; }
export async function setStorageMode(_mode: StorageMode): Promise<void> { await AsyncStorage.setItem(STORAGE_MODE_KEY, 'local'); }
export async function activateLocalStorage(): Promise<void> {
  await activatePolicy({ getItem: key => AsyncStorage.getItem(key), setItems: rows => AsyncStorage.multiSet(rows) });
}
export async function getLegacyCloudState(): Promise<LegacyCloudState | null> {
  const value = await AsyncStorage.getItem(LEGACY_CLOUD_KEY);
  return value ? JSON.parse(value) as LegacyCloudState : null;
}
export async function saveLegacyCloudState(state: LegacyCloudState): Promise<void> {
  await AsyncStorage.setItem(LEGACY_CLOUD_KEY, JSON.stringify(state));
}
export async function getOrCreateDeviceKey(): Promise<string> {
  let key = await AsyncStorage.getItem(DEVICE_KEY_KEY);
  if (!key) { key = Crypto.randomUUID(); await AsyncStorage.setItem(DEVICE_KEY_KEY, key); }
  return key;
}
export async function getDeviceKey(): Promise<string | null> { return AsyncStorage.getItem(DEVICE_KEY_KEY); }
