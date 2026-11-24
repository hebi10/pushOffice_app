import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushOfficeNative, isPushOfficeNativeAvailable } from '../../../modules/push-office-native';
import type { UserSettings } from '../../types';
import { localGetSettings, withSettingsLock, writeLocalSettings } from './localStore';
import { getLegacyCloudState } from './storageMode';
import { effectiveSchedulingSettings } from './settingsRecoveryPolicy';
import { restoreWithSettings } from './backupFlow';
import { store } from '../../store/store';
import { updateSettings } from '../../store/slices/settingsSlice';
const marker = (uid: string) => `@pushoffice/native-cloud-settings-v1/${uid}`;
export const legacySettingsRecovered = async (uid: string) => !!await AsyncStorage.getItem(marker(uid));
async function configure(settings: Partial<UserSettings>, unresolved: boolean) {
    const effective = effectiveSchedulingSettings(settings, unresolved, Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (isPushOfficeNativeAvailable) {
        await PushOfficeNative.configure({ ...effective,
            dailyBriefingTime: `${String(effective.dailyBriefingTime.hour).padStart(2, '0')}:${String(effective.dailyBriefingTime.minute).padStart(2, '0')}` });
        if (settings.themeMode) await PushOfficeNative.setUiTheme(settings.themeMode);
    }
    store.dispatch(updateSettings(effective));
}
async function settingsUnresolved() {
    const state = await getLegacyCloudState();
    return !!state && (state.pending || !!state.uid) && !(state.uid && await legacySettingsRecovered(state.uid));
}
/** A completed user save includes native scheduling; remote recovery shares this same queue. */
export function saveAssistantSettings(patch: Partial<UserSettings>) {
    return withSettingsLock(async () => {
        const merged = { ...await localGetSettings(), ...patch };
        await writeLocalSettings(merged);
        await configure(merged, await settingsUnresolved());
        store.dispatch(updateSettings(patch));
    });
}
/** Reads persisted values inside the same queue as UI edits/recovery; never configures stale Redux snapshots. */
export function syncNativeSettings() {
    return withSettingsLock(async () => {
        await configure(await localGetSettings() ?? {}, await settingsUnresolved());
    });
}
export function commitRecoveredSettings(uid: string, remote: Partial<UserSettings>) {
    return withSettingsLock(async () => {
        // Persisted patches are explicit local choices, including ones saved while the network read was pending.
        const merged = { ...remote, ...await localGetSettings() };
        await configure(merged, false);
        await writeLocalSettings(merged);
        await AsyncStorage.setItem(marker(uid), 'done');
    });
}

/** Keep recovery/ordinary writes out of the rollback window. Never roll back after a committed import. */
export function withBackupSettingsRestore<T>(restored: UserSettings, restore: () => Promise<T>): Promise<T> {
    return withSettingsLock(async () => {
        const persisted = await localGetSettings();
        const previous = store.getState().settings;
        const unresolved = await settingsUnresolved();
        return restoreWithSettings(async () => {
            await writeLocalSettings(restored);
            await configure(restored, unresolved);
            store.dispatch(updateSettings(restored));
        }, restore, async () => {
            await writeLocalSettings(persisted);
            await configure({...persisted, themeMode: previous.themeMode}, unresolved);
            store.dispatch(updateSettings(previous));
        });
    });
}
