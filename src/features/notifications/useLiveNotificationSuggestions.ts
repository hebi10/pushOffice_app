import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PushOfficeNative, type NotificationSuggestion, type NotificationSuggestionStatus } from '../../../modules/push-office-native';

export function useLiveNotificationSuggestions() {
  const [items,setItems] = useState<NotificationSuggestion[]>([]);
  const [status,setStatus] = useState<NotificationSuggestionStatus | null>(null);
  const [error,setError] = useState(false);
  const [refreshing,setRefreshing] = useState(false);
  const active = useRef(false);
  const revision = useRef(0);
  const pending = useRef(false);
  const rerun = useRef(false);

  const refresh = useCallback(async () => {
    if (!active.current) return;
    if (pending.current) { rerun.current = true; return; }
    pending.current = true;
    setRefreshing(true);
    try {
      do {
        rerun.current = false;
        const visit = revision.current;
        try {
          const snapshot = await PushOfficeNative.getNotificationSuggestionSnapshot();
          if (!active.current || visit !== revision.current) continue;
          setStatus(snapshot.status);
          setItems(snapshot.status.enabled && snapshot.status.accessGranted ? snapshot.items : []);
          setError(false);
        } catch {
          if (active.current && visit === revision.current) {
            setItems([]); setStatus(null); setError(true);
          }
        }
      } while (active.current && rerun.current);
    } finally {
      pending.current = false;
      if (active.current) setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      active.current = false;
      revision.current++;
      rerun.current = false;
      if (timer) clearTimeout(timer);
      setItems([]); setStatus(null); setError(false); setRefreshing(false);
    };
    const resume = () => {
      if (AppState.currentState === 'background' || AppState.currentState === 'inactive') { clear(); return; }
      active.current = true;
      revision.current++;
      void refresh();
    };
    resume();
    const listener = PushOfficeNative.addListener('notificationSuggestionsChanged', () => {
      if (!active.current) return;
      // A consent/permission change must not leave the previous rows visible.
      setItems([]); setStatus(null);
      revision.current++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 150);
    });
    const app = AppState.addEventListener('change', resume);
    // Permission revoked by Android may not emit a store event until the next read.
    const interval = setInterval(() => { if (active.current) void refresh(); }, 15000);
    return () => { clear(); clearInterval(interval); listener.remove(); app.remove(); };
  }, [refresh]));
  return { items, status, error, refreshing, refresh };
}
