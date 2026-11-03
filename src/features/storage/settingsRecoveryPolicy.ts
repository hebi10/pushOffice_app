import type { UserSettings } from '../../types';
/** Scheduling fields only: no remote account metadata or implicit external-service opt-in. */
export function recoveredSchedulingSettings(remote: Record<string, unknown>): Partial<UserSettings> {
    const result: Partial<UserSettings> = {};
    for (const key of ['pushEnabled', 'dailyBriefingEnabled'] as const) {
        if (typeof remote[key] !== 'boolean') throw new Error(`이전 ${key} 설정이 올바르지 않습니다.`);
        result[key] = remote[key];
    }
    if (remote.timezone !== undefined) {
        if (typeof remote.timezone !== 'string') throw new Error('이전 시간대 설정이 올바르지 않습니다.');
        new Intl.DateTimeFormat('en', { timeZone: remote.timezone }).format();
        result.timezone = remote.timezone;
    }
    if (remote.dailyBriefingTime !== undefined) {
        const time = remote.dailyBriefingTime as {hour?: unknown; minute?: unknown} | null;
        if (!time || !Number.isInteger(time.hour) || !Number.isInteger(time.minute) || Number(time.hour) < 0 || Number(time.hour) > 23 || Number(time.minute) < 0 || Number(time.minute) > 59) throw new Error('이전 브리핑 시간이 올바르지 않습니다.');
        result.dailyBriefingTime = {hour: Number(time.hour), minute: Number(time.minute)};
    }
    return result;
}
export function effectiveSchedulingSettings(local: Partial<UserSettings>, unresolved: boolean, zone: string) {
    return { pushEnabled: local.pushEnabled ?? !unresolved, dailyBriefingEnabled: local.dailyBriefingEnabled ?? false,
        dailyBriefingTime: local.dailyBriefingTime ?? {hour: 8, minute: 0}, timezone: local.timezone ?? zone };
}
/** Read current local choices inside the caller's serialization lock after remote I/O completes. */
export async function recoverSchedulingSettings(deps: {
    readRemote(): Promise<Record<string, unknown>>;
    commit(remote: Partial<UserSettings>): Promise<void>;
}) {
    const remote = recoveredSchedulingSettings(await deps.readRemote());
    await deps.commit(remote);
}
export class SettingsQueue {
    private tail: Promise<unknown> = Promise.resolve();
    run<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.tail.then(operation);
        this.tail = result.catch(() => {});
        return result;
    }
}
