/**
 * 저장 모드 관리 – firebase | local
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import type { StorageMode } from '../../types';

const STORAGE_MODE_KEY = '@pushoffice/storageMode';
const DEVICE_KEY_KEY = '@pushoffice/deviceKey';

/** 저장 모드 읽기 (없으면 null → 앱이 첫 실행 or 미설정) */
export async function getStorageMode(): Promise<StorageMode | null> {
  const val = await AsyncStorage.getItem(STORAGE_MODE_KEY);
  if (val === 'firebase' || val === 'local') return val;
  return null;
}

/** 저장 모드 설정 */
export async function setStorageMode(mode: StorageMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_MODE_KEY, mode);
}

/** deviceKey 가져오기 (없으면 새로 생성) */
export async function getOrCreateDeviceKey(): Promise<string> {
  let key = await AsyncStorage.getItem(DEVICE_KEY_KEY);
  if (!key) {
    key = uuidv4();
    await AsyncStorage.setItem(DEVICE_KEY_KEY, key);
  }
  return key;
}

/** deviceKey 읽기만 (없으면 null) */
export async function getDeviceKey(): Promise<string | null> {
  return AsyncStorage.getItem(DEVICE_KEY_KEY);
}
