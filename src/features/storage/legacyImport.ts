import type { NativeSchedule } from '../../../modules/push-office-native';
export interface LegacyImportDependencies {
  readMarker(key: string): Promise<string | null | undefined>;
  writeMarker(key: string, value: string): Promise<unknown>;
  readRecords(): Promise<NativeSchedule[]>;
  importRecords(records: NativeSchedule[]): Promise<unknown>;
  cancelLegacy(notificationIds: string[]): Promise<void>;
}
/** Import completion is durable before retryable cleanup, so a deletion can never trigger re-import. */
export async function importLegacyOnce(key: string, deps: LegacyImportDependencies): Promise<void> {
  let imported = await deps.readMarker(key);
  if (!imported) {
    const records = await deps.readRecords();
    await deps.importRecords(records);
    imported = JSON.stringify({ notificationIds: [...new Set(records.map(r => r.notificationId).filter((id): id is string => !!id))] });
    await deps.writeMarker(key, imported);
  }
  // v1's 'done' marker already included cleanup. Never read old records again after an imported marker.
  if (imported === 'done' || await deps.readMarker(`${key}/cleanup-v2`)) return;
  const { notificationIds } = JSON.parse(imported) as { notificationIds: string[] };
  await deps.cancelLegacy(notificationIds);
  await deps.writeMarker(`${key}/cleanup-v2`, 'done');
}
