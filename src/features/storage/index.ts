export {
    localGetAllDigests,
    localGetAllSchedules,
    localGetSettings,
    localSaveSettings
} from './localStore';
export { getOrCreateDeviceKey, getStorageMode, setStorageMode } from './storageMode';
export { getDigestAdapter, getDigestAdapterByMode } from './storeAdapter';
export type { DigestAdapter } from './storeAdapter';

