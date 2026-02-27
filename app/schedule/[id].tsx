/**
 * Schedule Detail 화면 – 일정 상세 + 재알림
 */
import { Card } from '@/src/components/Card';
import { Loading } from '@/src/components/Loading';
import { confirmAction, showError, showToast } from '@/src/components/ui/toast';
import {
    cancelNotification,
    scheduleReminder1Hour,
    scheduleReminderNextMonth,
    scheduleReminderTomorrow,
} from '@/src/features/notifications';
import { useDeleteSchedule, useScheduleDetail, useUpdateSchedule } from '@/src/features/schedules';
import { dayjs } from '@/src/lib/time';
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
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>일정을 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 기본 정보 */}
        <Card>
          <Text style={styles.title}>{schedule.title}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>📆 날짜/시간</Text>
            <Text style={styles.value}>
              {dayjs(startAt).format('YYYY년 M월 D일 (ddd) HH:mm')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>🔄 반복</Text>
            <Text style={styles.value}>{REPEAT_LABEL[schedule.repeatType]}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>🔔 알림</Text>
            <TouchableOpacity onPress={handleToggleNotification}>
              <Text style={[styles.value, { color: '#4A90D9' }]}>
                {schedule.notificationEnabled ? 'ON (탭하여 끄기)' : 'OFF (탭하여 켜기)'}
              </Text>
            </TouchableOpacity>
          </View>
          {schedule.sourceText && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>💬 원문</Text>
              <Text style={styles.value}>{schedule.sourceText}</Text>
            </View>
          )}
        </Card>

        {/* 재알림 */}
        <Card>
          <Text style={styles.sectionTitle}>⏰ 재알림</Text>
          <TouchableOpacity style={styles.reminderBtn} onPress={handleReminder1h}>
            <Text style={styles.reminderBtnText}>1시간 뒤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reminderBtn} onPress={handleReminderTomorrow}>
            <Text style={styles.reminderBtnText}>내일 같은 시간</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reminderBtn} onPress={handleReminderNextMonth}>
            <Text style={styles.reminderBtnText}>다음 달 같은 날짜/시간</Text>
          </TouchableOpacity>
        </Card>

        {/* 삭제 */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑 일정 삭제</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingVertical: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#999' },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  label: { fontSize: 13, color: '#888', width: 90 },
  value: { fontSize: 14, color: '#333', flex: 1, textAlign: 'right' },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  reminderBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD',
  },
  reminderBtnText: { fontSize: 14, color: '#4A90D9', fontWeight: '500' },

  deleteBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E55',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, color: '#E55', fontWeight: '600' },
});
