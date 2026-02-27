/**
 * Settings 화면 – 알림/브리핑 설정
 */
import { Card } from '@/src/components/Card';
import { showError, showToast } from '@/src/components/ui/toast';
import { updateUserSettings } from '@/src/features/auth/authService';
import {
    cancelDailyBriefing,
    requestNotificationPermission,
    scheduleDailyBriefing,
} from '@/src/features/notifications';
import { setDailyBriefing, setPushEnabled } from '@/src/store/slices/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/src/store/store';
import React, { useCallback } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRIEFING_HOURS = [6, 7, 8, 9, 10];

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.auth.uid);
  const settings = useAppSelector((s) => s.settings);

  /** 알림 권한 토글 */
  const handlePushToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }
      dispatch(setPushEnabled(value));
      if (uid) {
        try {
          await updateUserSettings(uid, { pushEnabled: value });
        } catch (error) {
          showError(error);
        }
      }
    },
    [dispatch, uid],
  );

  /** 브리핑 토글 */
  const handleBriefingToggle = useCallback(
    async (value: boolean) => {
      dispatch(setDailyBriefing({ enabled: value }));

      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          dispatch(setDailyBriefing({ enabled: false }));
          return;
        }
        try {
          await scheduleDailyBriefing(
            settings.dailyBriefingTime.hour,
            settings.dailyBriefingTime.minute,
          );
          showToast(`매일 ${settings.dailyBriefingTime.hour}시에 브리핑 알림`);
        } catch (error) {
          showError(error);
        }
      } else {
        await cancelDailyBriefing();
      }

      if (uid) {
        try {
          await updateUserSettings(uid, { dailyBriefingEnabled: value });
        } catch (error) {
          showError(error);
        }
      }
    },
    [dispatch, uid, settings.dailyBriefingTime],
  );

  /** 브리핑 시간 선택 */
  const handleBriefingHour = useCallback(
    async (hour: number) => {
      dispatch(setDailyBriefing({ enabled: true, hour, minute: 0 }));

      if (settings.dailyBriefingEnabled) {
        try {
          await scheduleDailyBriefing(hour, 0);
          showToast(`브리핑 시간: 매일 ${hour}시`);
        } catch (error) {
          showError(error);
        }
      }

      if (uid) {
        try {
          await updateUserSettings(uid, { dailyBriefingTime: { hour, minute: 0 } });
        } catch (error) {
          showError(error);
        }
      }
    },
    [dispatch, uid, settings.dailyBriefingEnabled],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 알림 */}
        <Card>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>🔔 푸시 알림</Text>
              <Text style={styles.rowDesc}>일정 알림을 받습니다</Text>
            </View>
            <Switch
              value={settings.pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>
        </Card>

        {/* 일일 브리핑 */}
        <Card>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>📋 일일 브리핑</Text>
              <Text style={styles.rowDesc}>매일 아침 오늘 일정을 알려줍니다</Text>
            </View>
            <Switch
              value={settings.dailyBriefingEnabled}
              onValueChange={handleBriefingToggle}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>

          {settings.dailyBriefingEnabled && (
            <View style={styles.timeSelector}>
              <Text style={styles.timeLabel}>알림 시간</Text>
              <View style={styles.timeOptions}>
                {BRIEFING_HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.timeChip,
                      settings.dailyBriefingTime.hour === h && styles.timeChipActive,
                    ]}
                    onPress={() => handleBriefingHour(h)}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        settings.dailyBriefingTime.hour === h && styles.timeChipTextActive,
                      ]}
                    >
                      {h}시
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* 계정 정보 */}
        <Card>
          <Text style={styles.rowTitle}>👤 계정</Text>
          <Text style={styles.infoText}>
            {uid ? `UID: ${uid.slice(0, 12)}...` : '로그인 중...'}
          </Text>
          <Text style={styles.infoText}>타임존: {settings.timezone}</Text>
        </Card>

        {/* 앱 정보 */}
        <Card>
          <Text style={styles.rowTitle}>ℹ️ 앱 정보</Text>
          <Text style={styles.infoText}>AI Push Assistant v1.0.0</Text>
          <Text style={styles.infoText}>Expo + Firebase</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingVertical: 12 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 2 },
  rowDesc: { fontSize: 12, color: '#888' },

  timeSelector: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEE' },
  timeLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  timeOptions: { flexDirection: 'row', gap: 8 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  timeChipActive: { backgroundColor: '#4A90D9' },
  timeChipText: { fontSize: 13, color: '#666' },
  timeChipTextActive: { color: '#FFF', fontWeight: '600' },

  infoText: { fontSize: 13, color: '#888', marginTop: 4 },
});
