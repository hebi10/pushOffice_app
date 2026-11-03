import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { PushOfficeNative, isPushOfficeNativeAvailable } from '../../../modules/push-office-native';
import { hydrateSchedule, toNativeSchedule } from '../schedules/scheduleCodec';
import { importLegacyOnce } from './legacyImport';
import { localGetAllSchedules, localGetSettings } from './localStore';
export async function importLegacyRecords(key: string, read = localGetAllSchedules): Promise<void> {
  if (!isPushOfficeNativeAvailable) throw new Error('이전 일정 가져오기는 Android 앱 빌드에서 사용할 수 있습니다.');
  const settings = await localGetSettings();
  await importLegacyOnce(key, {
    readMarker: marker => AsyncStorage.getItem(marker), writeMarker: (marker, value) => AsyncStorage.setItem(marker, value),
    readRecords: async () => (await read()).map(record => toNativeSchedule({ ...record, anchorZone: record.anchorZone ?? (record as typeof record & {timezone?:string}).timezone ?? settings?.timezone })).filter(s => !!s.id),
    importRecords: records => PushOfficeNative.importSchedules(records),
    // Never touch alarms whose source did not import successfully.
    cancelLegacy: async ids => { for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id); },
  });
}
/** Only after all applicable sources complete: retire old daily/background infrastructure. */
export async function finishLegacyNotificationCleanup(): Promise<void> {
  const key = '@pushoffice/legacy-daily-cleanup-v2';
  if (await AsyncStorage.getItem(key)) return;
  for (const notification of await Notifications.getAllScheduledNotificationsAsync()) {
    if (notification.content.data?.route === '/briefing') await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
  if (await TaskManager.isTaskRegisteredAsync('BACKGROUND_DIGEST_TASK')) await BackgroundFetch.unregisterTaskAsync('BACKGROUND_DIGEST_TASK');
  await AsyncStorage.setItem(key, 'done');
}
export async function getDeviceSchedules() {
  const records = isPushOfficeNativeAvailable ? await PushOfficeNative.getSchedules() : (await localGetAllSchedules()).map(toNativeSchedule);
  return records.map(hydrateSchedule);
}
