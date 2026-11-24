export const ENCRYPTED_BACKUP_FAMILY = 'PUSH-OFFICE-ENCRYPTED-BACKUP-';
export const isEncryptedBackup = (text: string) => text.startsWith(ENCRYPTED_BACKUP_FAMILY);
export type BackupMode = 'plain' | 'encrypted';
export type BackupHistory = { savedAt: number; mode: BackupMode };

export function validateBackupPassword(password: string, confirmation?: string) {
  if (password.length < 12 || password.length > 128 || !password.trim()) {
    throw new Error('백업 비밀번호는 12~128자로 입력해 주세요.');
  }
  if (confirmation !== undefined && password !== confirmation) {
    throw new Error('비밀번호 확인이 일치하지 않습니다.');
  }
}

export function readBackupHistory(raw: string | null): BackupHistory | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !Number.isSafeInteger(value.savedAt) || value.savedAt <= 0 ||
        (value.mode !== 'plain' && value.mode !== 'encrypted')) return null;
    return {savedAt: value.savedAt, mode: value.mode};
  } catch { return null; }
}

/** Only committed file saves update history. Metadata failure must not misreport file failure. */
export async function recordSuccessfulBackup(
  saved: boolean, mode: BackupMode, persist: (history: BackupHistory) => Promise<void>, now = Date.now(),
): Promise<{history: BackupHistory | null; historyRecorded: boolean}> {
  if (!saved) return {history: null, historyRecorded: false};
  const history = {savedAt: now, mode};
  try {
    await persist(history);
    return {history, historyRecorded: true};
  } catch { return {history, historyRecorded: false}; }
}

/** The caller serializes settings recovery and ordinary settings writes across this whole operation. */
export async function restoreWithSettings<T>(
  apply: () => Promise<void>, restore: () => Promise<T>, rollback: () => Promise<void>,
): Promise<T> {
  try {
    await apply();
    return await restore();
  } catch (error) {
    try { await rollback(); }
    catch { throw new Error('복원이 중단되었고 기존 설정을 자동으로 되돌리지 못했습니다. 설정을 확인해 주세요.'); }
    throw error;
  }
}
