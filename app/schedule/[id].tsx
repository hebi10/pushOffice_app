/**
 * Schedule Detail 화면 – 일정 상세 + 재알림
 */
import { Card } from '@/src/components/Card';
import { Loading } from '@/src/components/Loading';
import { confirmAction, showError, showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  cancelNotification,
  scheduleReminder1Hour,
  scheduleReminderNextMonth,
  scheduleReminderTomorrow,
} from '@/src/features/notifications';
import { useDeleteSchedule, useScheduleDetail, useUpdateSchedule } from '@/src/features/schedules';
import { dayjs } from '@/src/lib/time';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const REPEAT_LABEL: Record<string, string> = {
  none: '반복 없음',
  monthly: '매월 반복',
  yearly: '매년 반복',
};

export default function ScheduleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: schedule, isLoading } = useScheduleDetail(id);
  const updateMutation = useUpdateSchedule();
  const deleteMutation = useDeleteSchedule();
  const { colors } = useTheme();

  const startAt = schedule?.startAt?.toDate?.() ?? new Date();

  /** 알림 토글 */
  const handleToggleNotification = useCallback(async () => {
    if (!schedule?.id) return;

    if (schedule.notificationEnabled && schedule.notificationId) {
      try {
        await cancelNotification(schedule.notificationId);
      } catch { /* ignore */ }
    }

    try {
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: {
          notificationEnabled: !schedule.notificationEnabled,
          notificationId: !schedule.notificationEnabled ? schedule.notificationId : null,
        },
      });
      showToast(schedule.notificationEnabled ? '알림 해제' : '알림 켜짐');
    } catch (error) {
      showError(error);
    }
  }, [schedule, updateMutation]);

  /** 재알림: 1시간 뒤 */
  const handleReminder1h = useCallback(async () => {
    if (!schedule?.id) return;
    try {
      const notifId = await scheduleReminder1Hour(schedule.id, schedule.title);
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: { notificationId: notifId },
      });
      showToast('1시간 뒤 재알림 설정');
    } catch (error) {
      showError(error);
    }
  }, [schedule, updateMutation]);

  /** 재알림: 내일 */
  const handleReminderTomorrow = useCallback(async () => {
    if (!schedule?.id) return;
    try {
      const notifId = await scheduleReminderTomorrow(schedule.id, schedule.title, startAt);
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: { notificationId: notifId },
      });
      showToast('내일 같은 시간 재알림 설정');
    } catch (error) {
      showError(error);
    }
  }, [schedule, updateMutation, startAt]);

  /** 재알림: 다음 달 */
  const handleReminderNextMonth = useCallback(async () => {
    if (!schedule?.id) return;
    try {
      const notifId = await scheduleReminderNextMonth(schedule.id, schedule.title, startAt);
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: { notificationId: notifId },
      });
      showToast('다음 달 재알림 설정');
    } catch (error) {
      showError(error);
    }
  }, [schedule, updateMutation, startAt]);

  /** 삭제 */
  const handleDelete = useCallback(() => {
    if (!schedule?.id) return;
    confirmAction('일정 삭제', '이 일정을 삭제할까요?', async () => {
      try {
        if (schedule.notificationId) {
          try {
            await cancelNotification(schedule.notificationId);
          } catch { /* ignore */ }
        }
        await deleteMutation.mutateAsync(schedule.id!);
        showToast('일정이 삭제되었습니다.');
        router.back();
      } catch (error) {
        showError(error);
      }
    });
  }, [schedule, deleteMutation]);

  if (isLoading) return <Loading />;

  if (!schedule) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>일정을 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 기본 정보 */}
        <Card>
          <Text style={[styles.title, { color: colors.text }]}>{schedule.title}</Text>
          <View style={[styles.infoRow, { borderTopColor: colors.divider }]}>
            <View style={styles.labelRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>날짜/시간</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>
              {dayjs(startAt).format('YYYY년 M월 D일 (ddd) HH:mm')}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.divider }]}>
            <View style={styles.labelRow}>
              <Ionicons name="repeat-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>반복</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>{REPEAT_LABEL[schedule.repeatType]}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.divider }]}>
            <View style={styles.labelRow}>
              <Ionicons name="notifications-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>알림</Text>
            </View>
            <TouchableOpacity onPress={handleToggleNotification}>
              <Text style={[styles.value, { color: colors.primary }]}>
                {schedule.notificationEnabled ? 'ON (탭하여 끄기)' : 'OFF (탭하여 켜기)'}
              </Text>
            </TouchableOpacity>
          </View>
          {schedule.sourceText && (
            <View style={[styles.infoRow, { borderTopColor: colors.divider }]}>
              <View style={styles.labelRow}>
                <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>원문</Text>
              </View>
              <Text style={[styles.value, { color: colors.text }]}>{schedule.sourceText}</Text>
            </View>
          )}
        </Card>

        {/* 재알림 */}
        <Card>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="alarm-outline" size={16} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>재알림</Text>
          </View>
          <TouchableOpacity
            style={[styles.reminderBtn, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={handleReminder1h}
          >
            <Text style={[styles.reminderBtnText, { color: colors.primary }]}>1시간 뒤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reminderBtn, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={handleReminderTomorrow}
          >
            <Text style={[styles.reminderBtnText, { color: colors.primary }]}>내일 같은 시간</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reminderBtn, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={handleReminderNextMonth}
          >
            <Text style={[styles.reminderBtnText, { color: colors.primary }]}>다음 달 같은 날짜/시간</Text>
          </TouchableOpacity>
        </Card>

        {/* 삭제 */}
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.surface, borderColor: colors.danger }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.deleteBtnText, { color: colors.danger }]}>일정 삭제</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingVertical: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14 },

  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 100,
  },
  label: { fontSize: 13 },
  value: { fontSize: 14, flex: 1, textAlign: 'right' },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  reminderBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reminderBtnText: { fontSize: 14, fontWeight: '500' },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
});
