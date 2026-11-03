import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { PushOfficeNative, isPushOfficeNativeAvailable, type ReminderCapabilities } from '../../../modules/push-office-native';
import { syncNativeSettings } from '../storage/nativeSettings';
import { useAppSelector } from '../../store/store';
export function useNativeAssistantSync() {
    const query = useQueryClient();
    const settings = useAppSelector(s => s.settings);
    const loading = useAppSelector(s => s.auth.isLoading);
    useEffect(() => {
        const refresh = () => { void query.invalidateQueries({ queryKey: ['schedules'] }); void query.invalidateQueries({ queryKey: ['digests'] }); };
        const native = PushOfficeNative.addListener('schedulesChanged', refresh);
        const app = AppState.addEventListener('change', state => { if (state === 'active') {
            refresh(); if (isPushOfficeNativeAvailable) void PushOfficeNative.refreshWidgets().catch(console.warn);
        } });
        return () => { native.remove(); app.remove(); };
    }, [query]);
    useEffect(() => {
        if (loading || !isPushOfficeNativeAvailable)
            return;
        void syncNativeSettings().catch(console.warn);
    }, [loading, settings.pushEnabled, settings.dailyBriefingEnabled, settings.dailyBriefingTime.hour, settings.dailyBriefingTime.minute, settings.timezone]);
}
/** Refresh dates on resume and while open across midnight. */
export function useClock() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);
        const sub = AppState.addEventListener('change', state => { if (state === 'active')
            setNow(Date.now()); });
        return () => { clearInterval(timer); sub.remove(); };
    }, []);
    return now;
}
export async function reminderCapabilities(): Promise<ReminderCapabilities | null> {
    return isPushOfficeNativeAvailable ? PushOfficeNative.configure({}) : null;
}
