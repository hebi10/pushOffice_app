/**
 * 백그라운드 브리핑 생성 (Local mode)
 * expo-background-fetch + expo-task-manager
 *
 * 제약: 플랫폼에 따라 백그라운드 실행이 보장되지 않을 수 있음.
 * 최소 보장: 로컬 알림은 시간에 맞춰 울리고, 탭하면 앱에서 생성/표시.
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { dayjs } from '../../lib/time';
import { generateAndSaveDigest } from '../digest/digestService';
import { localGetDigestByDate, localGetSettings } from '../storage/localStore';
import { getOrCreateDeviceKey, getStorageMode } from '../storage/storageMode';

const BACKGROUND_DIGEST_TASK = 'BACKGROUND_DIGEST_TASK';

/** 태스크 정의 */
TaskManager.defineTask(BACKGROUND_DIGEST_TASK, async () => {
  try {
    const mode = await getStorageMode();
    if (mode !== 'local') return BackgroundFetch.BackgroundFetchResult.NoData;

    const settings = await localGetSettings();
    if (!settings?.dailyBriefingEnabled) return BackgroundFetch.BackgroundFetchResult.NoData;

    const deviceKey = await getOrCreateDeviceKey();
    const todayKey = dayjs().format('YYYY-MM-DD');

    // 이미 오늘 digest가 있으면 스킵
    const existing = await localGetDigestByDate(deviceKey, todayKey);
    if (existing) return BackgroundFetch.BackgroundFetchResult.NoData;

    // 브리핑 시간 확인
    const briefingTime = settings.dailyBriefingTime || { hour: 8, minute: 0 };
    const now = dayjs();
    const targetMinutes = briefingTime.hour * 60 + (briefingTime.minute || 0);
    const currentMinutes = now.hour() * 60 + now.minute();

    if (currentMinutes < targetMinutes) return BackgroundFetch.BackgroundFetchResult.NoData;

    // digest 생성
    const digestTypes = settings.digestTypes || { weather: true, stocks: false, news: false };
    await generateAndSaveDigest({
      ownerType: 'device',
      ownerId: deviceKey,
      dateKey: todayKey,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      types: digestTypes,
      city: settings.digestCity || 'Seoul',
      stockTickers: settings.stockTickers || [],
      newsKeywords: settings.newsKeywords || [],
      newsLanguage: settings.newsLanguage || 'ko',
    });

    // 로컬 알림 발송
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '오늘 브리핑',
        body: '오늘의 브리핑이 준비되었습니다.',
        sound: 'default',
        data: { route: '/briefing', dateKey: todayKey },
        ...(Platform.OS === 'android' ? { channelId: 'briefing' } : {}),
      },
      trigger: null, // 즉시 발송
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.warn('[BackgroundDigest] 실패:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** 백그라운드 태스크 등록 */
export async function registerBackgroundDigestTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_DIGEST_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(BACKGROUND_DIGEST_TASK, {
      minimumInterval: 15 * 60, // 최소 15분 간격
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {
    console.warn('[BackgroundDigest] 태스크 등록 실패:', e);
  }
}

/** 백그라운드 태스크 해제 */
export async function unregisterBackgroundDigestTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_DIGEST_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_DIGEST_TASK);
    }
  } catch {
    // ignore
  }
}

/** Local mode 전용: 매일 브리핑 로컬 알림 예약 */
export async function scheduleLocalDigestNotification(
  hour: number,
  minute: number,
): Promise<string | null> {
  try {
    // 기존 브리핑 알림 취소
    await cancelLocalDigestNotification();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '오늘 브리핑',
        body: '오늘의 브리핑을 확인하세요.',
        sound: 'default',
        data: { route: '/briefing' },
        ...(Platform.OS === 'android' ? { channelId: 'briefing' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    });
    return id;
  } catch (e) {
    console.warn('[LocalDigest] 알림 예약 실패:', e);
    return null;
  }
}

/** 브리핑 로컬 알림 취소 */
export async function cancelLocalDigestNotification(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content.data?.route === '/briefing') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // ignore
  }
}
