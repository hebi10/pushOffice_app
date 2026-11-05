import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface NativeSchedule {
  id: string;
  userId: string;
  type: string;
  title: string;
  /** Original recurrence anchor, epoch milliseconds. Never advance it after firing. */
  startAt: number;
  /** Canonical IANA recurrence zone returned by native storage; optional for legacy/new input. */
  anchorZone?: string;
  endAt: number | null;
  isAllDay: boolean;
  repeatType: 'none' | 'monthly' | 'yearly';
  notificationEnabled: boolean;
  notificationId: string | null;
  sourceText: string;
  createdAt: number;
  updatedAt: number;
}
export interface NativeSettings {
  pushEnabled: boolean;
  dailyBriefingEnabled: boolean;
  dailyBriefingTime: string;
  timezone: string;
}
export interface ReminderCapabilities {
  exactAlarmAllowed: boolean;
  notificationsAllowed: boolean;
  timing: 'exact' | 'inexact';
}
export interface AiStatus {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'error';
  message: string;
}
export type PushOfficeNativeEvents = { schedulesChanged: () => void };
export declare class PushOfficeNativeModule extends NativeModule<PushOfficeNativeEvents> {
  openQuickEntry(): Promise<void>;
  /** Actual system tile-add callback: added, already_added, not_added, error_<code>, unsupported_manual. */
  requestAddTile(): Promise<string>;
  /** Request accepted by launcher; true does not mean the user placed the widget. */
  requestPinWidget(kind: 'small' | 'agenda'): Promise<boolean>;
  getAiStatus(): Promise<AiStatus>;
  generateBriefing(prompt: string): Promise<string>;
  refreshWidgets(): Promise<void>;
  setUiTheme(mode: 'system' | 'light' | 'dark'): Promise<void>;
  getSchedules(): Promise<NativeSchedule[]>;
  saveSchedule(record: NativeSchedule): Promise<NativeSchedule>;
  /** Import without overwriting existing ids, retaining history without reserving past alarms. */
  importSchedules(records: NativeSchedule[]): Promise<number>;
  deleteSchedule(id: string): Promise<void>;
  configure(settings: Partial<NativeSettings>): Promise<ReminderCapabilities>;
  snoozeSchedule(id: string, minutes: number): Promise<number>;
  cancelSnooze(id: string): Promise<void>;
}

const native = Platform.OS === 'android'
  ? requireOptionalNativeModule<PushOfficeNativeModule>('PushOfficeNative')
  : null;
export const isPushOfficeNativeAvailable = native !== null;
const unavailable = async (): Promise<never> => {
  throw new Error('로컬 일정 기능은 Push Office Android 빌드에서 사용할 수 있습니다.');
};
/** Import-safe fallback; never silently claims a save or alarm was successful. */
export const PushOfficeNative: PushOfficeNativeModule = native ?? ({
  openQuickEntry: unavailable,
  requestAddTile: unavailable,
  requestPinWidget: unavailable,
  getAiStatus: async () => ({ status: 'unavailable', message: '기기 AI는 지원되는 Android 기기에서 사용할 수 있습니다.' }),
  generateBriefing: unavailable,
  refreshWidgets: unavailable,
  setUiTheme: unavailable,
  getSchedules: async () => [],
  saveSchedule: unavailable,
  importSchedules: unavailable,
  deleteSchedule: unavailable,
  configure: unavailable,
  snoozeSchedule: unavailable,
  cancelSnooze: unavailable,
  addListener: () => ({ remove() {} }),
  removeAllListeners() {},
} as unknown as PushOfficeNativeModule);
export default PushOfficeNative;
