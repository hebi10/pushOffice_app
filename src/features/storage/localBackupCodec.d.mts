import type { NativeSchedule } from '../../../modules/push-office-native';
import type { UserSettings } from '../../types';

export declare const MAX_LOCAL_BACKUP_LENGTH: number;
export interface LocalBackupPayload {
  packageName: 'com.hebi96.pushOffice_app';
  version: 1;
  exportedAt: string;
  schedules: NativeSchedule[];
  settings: UserSettings;
}
export declare function createLocalBackup(
  schedules: NativeSchedule[],
  settings: UserSettings,
  hash: (value: string) => Promise<string>,
  now?: Date
): Promise<string>;
export declare function parseLocalBackup(
  text: string,
  hash: (value: string) => Promise<string>
): Promise<LocalBackupPayload>;
