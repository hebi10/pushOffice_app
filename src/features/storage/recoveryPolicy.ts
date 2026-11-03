/** Pure migration policy. Active local storage and a pending read-only legacy source are separate facts. */
export const STORAGE_MODE_KEY = '@pushoffice/storageMode';
export const LEGACY_CLOUD_KEY = '@pushoffice/legacy-cloud-source-v2';
export interface LegacyCloudState { pending: boolean; uid?: string; message: string }
interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItems(entries: [string, string][]): Promise<void>;
}
export async function activateLocalStorage(storage: KeyValueStorage): Promise<void> {
  const [previous, pending] = await Promise.all([storage.getItem(STORAGE_MODE_KEY), storage.getItem(LEGACY_CLOUD_KEY)]);
  const writes: [string, string][] = [[STORAGE_MODE_KEY, 'local']];
  if (previous === 'firebase' && !pending) writes.push([LEGACY_CLOUD_KEY, JSON.stringify({ pending: true, message: '이전에 사용한 Firebase 일정 가져오기가 대기 중입니다.' })]);
  // Atomically retain the recovery condition while turning every normal service local.
  await storage.setItems(writes);
}
export async function bootstrapLocal<T>(deps: {
  activate(): Promise<void>;
  getIdentity(): Promise<string>;
  getSettings(): Promise<T>;
  publish(local: {identity: string; settings: T}): void;
  recover(): Promise<unknown>;
  onRecoveryError(error: unknown): void;
}): Promise<void> {
  await deps.activate();
  const [identity, settings] = await Promise.all([deps.getIdentity(), deps.getSettings()]);
  deps.publish({ identity, settings });
  // Recovery cannot delay local identity, saved settings or the UI, including when offline indefinitely.
  void deps.recover().catch(deps.onRecoveryError);
}
export async function recoverLegacySources(deps: {
  importLocal(): Promise<unknown>;
  getCloudState(): Promise<LegacyCloudState | null>;
  saveCloudState(state: LegacyCloudState): Promise<unknown>;
  configured(): boolean;
  cloudAlreadyImported?(uid: string): Promise<boolean>;
  readExistingIdentity(): Promise<string | null>;
  importCloud(uid: string): Promise<unknown>;
  settingsAlreadyRecovered?(uid: string): Promise<boolean>;
  recoverSettings?(uid: string): Promise<void>;
  finishCleanup(): Promise<void>;
}): Promise<LegacyCloudState | null> {
  let importedLocal = false;
  const importLocal = async () => { if (!importedLocal) { await deps.importLocal(); importedLocal = true; } };
  let state = await deps.getCloudState();
  if (state?.uid && deps.settingsAlreadyRecovered && !await deps.settingsAlreadyRecovered(state.uid)) state = { ...state, pending: true };

  if (state?.pending) {
    try {
      if (state.uid && (!deps.settingsAlreadyRecovered || await deps.settingsAlreadyRecovered(state.uid)) && await deps.cloudAlreadyImported?.(state.uid)) {
        await deps.recoverSettings?.(state.uid);
        await importLocal();
        await deps.importCloud(state.uid); // Imported marker makes this cleanup-only, with no cloud reads.
        state = {...state,pending:false,message:'이전 일정의 남은 알림 정리를 완료했어요. 원본은 보존됩니다.'};
      } else if (!deps.configured()) {
        state = { ...state, message: '이전 Firebase 설정이 없어 가져오기를 보류했어요. 원본과 기존 알림을 보존합니다.' };
      } else {
        const uid = await deps.readExistingIdentity();
        if (!uid || state.uid && uid !== state.uid) {
          state = { ...state, message: '이전에 사용하던 로그인 계정이 필요해요. 원본을 보존하며 설정에서 다시 시도할 수 있습니다.' };
        } else {
          state = { ...state, uid };
          await deps.saveCloudState(state);
          await deps.recoverSettings?.(uid);
          await importLocal();
          await deps.importCloud(uid);
          state = { ...state, pending: false, message: '이전 일정을 로컬로 가져왔어요. Firebase 원본은 그대로 보존됩니다.' };
        }
      }
    } catch (error) {
      state = { ...state, message: `가져오기를 완료하지 못했어요. 원본과 기존 알림은 보존됩니다. ${String(error)}` };
    }
    await deps.saveCloudState(state);
    if (state.pending) return state;
  }
  await importLocal(); // idempotent, including a cleanup-only retry
  // Daily/background cleanup is safe only when every applicable source imported successfully.
  await deps.finishCleanup();
  return state;
}
/** A focused route remains mounted while OS settings are open; focus alone cannot refresh permissions. */
export function subscribeOnActive(source: {addEventListener(event: 'change', listener: (state: string) => void): {remove(): void}}, refresh: () => void): () => void {
  const subscription = source.addEventListener('change', state => { if (state === 'active') refresh(); });
  return () => subscription.remove();
}
