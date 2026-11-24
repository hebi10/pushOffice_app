import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { ScheduleCategory } from '../../src/features/schedules/scheduleCategories.mjs';

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
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
  category?: ScheduleCategory | null;
  reminderOffsets?: number[];
  completedAt?: number | null;
  excludedStarts?: number[];
  isAllDay: boolean;
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
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
export interface ScheduleSyncResult { alarmsReady: boolean; widgetsReady: boolean }
export interface ScheduleConflict { id: string; title: string; startAt: number; proposedStart: number }

export interface ReminderCapabilities {
  exactAlarmAllowed: boolean;
  notificationsAllowed: boolean;
  timing: 'exact' | 'inexact';
}
export interface AiStatus {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'error';
  message: string;
  /** Non-sensitive code only. */
  errorCode?: string;
  retryable?: boolean;
}
export interface NotificationSuggestion {
  id: string;
  sourceApp: string;
  packageName: string;
  excerpt: string;
  title: string;
  /** null means the message did not provide a verified date/time. Never synthesize a timestamp. */
  startAt: number | null;
  receivedAt: number;
  analysis: 'on_device_ai' | 'local_rules';
  triage: 'confirmed_candidate' | 'needs_confirmation';
}
export interface NotificationSuggestionStatus {
  enabled: boolean;
  accessGranted: boolean;
  pendingCount: number;
}
export interface AiModelInfo {
  id: string;
  title: string;
  description: string;
  engine: 'AICore' | 'LiteRT-LM';
  license: string;
  approximateMb: number;
  sourceUrl: string;
  state: 'available' | 'downloadable' | 'downloading' | 'not_installed' | 'installed' | 'verifying' | 'error' | 'unavailable';
  selected: boolean;
  bytesDownloaded: number;
  totalBytes: number;
  message: string;
}
export interface AiModelTestResult {
  modelId: string;
  success: boolean;
  title?: string;
  startAt?: number;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  message?: string;
  durationMs: number;
}
export interface AiModelActionResult {
  state?: string;
  selected?: string;
  message?: string;
}
export interface AiDownloadProgress {
  status: 'started' | 'progress' | 'completed' | 'failed';
  bytesDownloaded: number;
  totalBytes: number;
  errorCode?: string;
}
export type PushOfficeNativeEvents = {
  schedulesChanged: () => void;
  notificationSuggestionsChanged: () => void;
  aiDownloadProgress: (update: AiDownloadProgress) => void;
};
export declare class PushOfficeNativeModule extends NativeModule<PushOfficeNativeEvents> {
  openQuickEntry(): Promise<void>;
  /** Calendar-only civil date (YYYY-MM-DD); original tile/widget/voice entries are unaffected. */
  openQuickEntryForDate(date: string): Promise<void>;
  /** Android SAF: user chooses the location. A cancelled picker returns false. */
  createLocalBackupDocument(text: string): Promise<boolean>;
  encryptLocalBackup(text: string, password: string): Promise<string>;
  decryptLocalBackup(text: string, password: string): Promise<string>;
  /** Android SAF: user chooses the file. A cancelled picker returns null. */
  pickLocalBackupDocument(): Promise<string | null>;
  /** Atomic, existing IDs are never overwritten; alarm refresh failure is reported separately. */
  importBackupSchedules(records: NativeSchedule[]): Promise<{ imported: number; alarmsReady: boolean }>;
  getNotificationSuggestionStatus(): Promise<NotificationSuggestionStatus>;
  getNotificationSuggestionSnapshot(): Promise<{status: NotificationSuggestionStatus; items: NotificationSuggestion[]}>;
  setNotificationCaptureEnabled(enabled: boolean): Promise<boolean>;
  openNotificationAccessSettings(): Promise<void>;
  getNotificationSuggestions(): Promise<NotificationSuggestion[]>;
  refineNotificationSuggestion(id: string): Promise<NotificationSuggestion>;
  dismissNotificationSuggestion(id: string): Promise<boolean>;
  openNotificationSuggestion(id: string): Promise<void>;
  /** Opens the existing voice editor without starting microphone capture. */
  openVoiceQuickEntry(): Promise<void>;
  /** Actual system tile-add callback: added, already_added, not_added, error_<code>, unsupported_manual. */
  requestAddTile(): Promise<string>;
  getQuickTileEnabled(): Promise<boolean>;
  setQuickTileEnabled(enabled: boolean): Promise<boolean>;
  /** Request accepted by launcher; true does not mean the user placed the widget. */
  requestPinWidget(kind: 'small' | 'agenda'): Promise<boolean>;
  getAiStatus(): Promise<AiStatus>;
  downloadAiModel(): Promise<AiStatus>;
  listAiModels(): Promise<AiModelInfo[]>;
  downloadAiModelById(id: string): Promise<AiModelActionResult>;
  removeAiModel(id: string): Promise<AiModelActionResult>;
  verifyAiModel(id: string): Promise<AiModelActionResult>;
  selectAiModel(id: string): Promise<AiModelActionResult>;
  testAiModel(id: string, text: string): Promise<AiModelTestResult>;
  generateBriefing(prompt: string): Promise<string>;
  refreshWidgets(): Promise<void>;
  setUiTheme(mode: 'system' | 'light' | 'dark'): Promise<void>;
  getSchedules(): Promise<NativeSchedule[]>;
  checkScheduleConflicts(record: NativeSchedule, ignoreOccurrenceAt: number | null): Promise<ScheduleConflict[]>;
  saveSchedule(record: NativeSchedule): Promise<NativeSchedule & ScheduleSyncResult>;
  /** Import without overwriting existing ids, retaining history without reserving past alarms. */
  importSchedules(records: NativeSchedule[]): Promise<number>;
  deleteSchedule(id: string): Promise<ScheduleSyncResult>;
  setScheduleCompleted(id: string, completed: boolean): Promise<ScheduleSyncResult>;
  mutateScheduleOccurrence(id: string, at: number, expectedUpdatedAt: number, action: 'edit' | 'delete' | 'complete', replacement: {title?: string; startAt?: number; endAt?: number | null}): Promise<ScheduleSyncResult & {detachedId: string | null}>;
  retryScheduleSync(): Promise<ScheduleSyncResult>;
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
  openQuickEntryForDate: unavailable,
  createLocalBackupDocument: unavailable,
  encryptLocalBackup: unavailable,
  decryptLocalBackup: unavailable,
  pickLocalBackupDocument: unavailable,
  importBackupSchedules: unavailable,
  getNotificationSuggestionStatus: async () => ({ enabled: false, accessGranted: false, pendingCount: 0 }),
  getNotificationSuggestionSnapshot: async () => ({ status: { enabled: false, accessGranted: false, pendingCount: 0 }, items: [] }),
  setNotificationCaptureEnabled: unavailable,
  openNotificationAccessSettings: unavailable,
  getNotificationSuggestions: async () => [],
  refineNotificationSuggestion: unavailable,
  dismissNotificationSuggestion: unavailable,
  openNotificationSuggestion: unavailable,
  openVoiceQuickEntry: unavailable,
  requestAddTile: unavailable,
  getQuickTileEnabled: async () => false,
  setQuickTileEnabled: unavailable,
  requestPinWidget: unavailable,
  getAiStatus: async () => ({ status: 'unavailable', message: '기기 AI는 지원되는 Android 기기에서 사용할 수 있습니다.' }),
  downloadAiModel: unavailable,
  listAiModels: async () => [],
  downloadAiModelById: unavailable,
  removeAiModel: unavailable,
  verifyAiModel: unavailable,
  selectAiModel: unavailable,
  testAiModel: unavailable,
  generateBriefing: unavailable,
  refreshWidgets: unavailable,
  setUiTheme: unavailable,
  getSchedules: async () => [],
  saveSchedule: unavailable,
  checkScheduleConflicts: unavailable,
  importSchedules: unavailable,
  deleteSchedule: unavailable,
  setScheduleCompleted: unavailable,
  mutateScheduleOccurrence: unavailable,
  retryScheduleSync: unavailable,
  configure: unavailable,
  snoozeSchedule: unavailable,
  cancelSnooze: unavailable,
  addListener: () => ({ remove() {} }),
  removeAllListeners() {},
} as unknown as PushOfficeNativeModule);
export default PushOfficeNative;
