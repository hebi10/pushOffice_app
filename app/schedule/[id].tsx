/**
 * Schedule Detail 화면 – 일정 상세 + 재알림 + 관련 일정 + 그날 브리핑
 */
import { Card } from '@/src/components/Card';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { confirmAction, showError, showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useDateDigest } from '@/src/features/digest';
import {
    cancelNotification,
    scheduleReminder1Hour,
    scheduleReminderNextMonth,
    scheduleReminderNextYear,
    scheduleReminderTomorrow,
} from '@/src/features/notifications';
import { useDeleteSchedule, useRelatedSchedules, useScheduleDetail, useUpdateSchedule } from '@/src/features/schedules';
import { dayjs } from '@/src/lib/time';
import type { RepeatType } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
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
  const dateKey = dayjs(startAt).format('YYYY-MM-DD');

  // ── 수정 모달 상태 ──
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [editIsAllDay, setEditIsAllDay] = useState(false);
  const [editRepeatType, setEditRepeatType] = useState<RepeatType>('none');

  /** 수정 모달 열기 */
  const handleOpenEdit = useCallback(() => {
    if (!schedule) return;
    const dt = schedule.startAt?.toDate?.() ?? new Date();
    setEditTitle(schedule.title);
    setEditDate(dayjs(dt).format('YYYY-MM-DD'));
    const allDay = schedule.isAllDay ?? false;
    setEditIsAllDay(allDay);
    setEditHour(allDay ? '' : String(dayjs(dt).hour()));
    setEditMinute(allDay ? '' : String(dayjs(dt).minute()).padStart(2, '0'));
    setEditRepeatType(schedule.repeatType);
    setShowEditModal(true);
  }, [schedule]);

  /** 하루종일 토글 시 시간 필드 초기화 */
  const handleAllDayToggle = useCallback((value: boolean) => {
    setEditIsAllDay(value);
    if (value) {
      setEditHour('');
      setEditMinute('');
    } else {
      setEditHour('9');
      setEditMinute('00');
    }
  }, []);

  /** 수정 저장 */
  const handleSaveEdit = useCallback(async () => {
    if (!schedule?.id || !editTitle.trim()) {
      Alert.alert('오류', '제목을 입력해 주세요.');
      return;
    }
    if (!editDate.trim()) {
      Alert.alert('오류', '날짜를 입력해 주세요. (형식: YYYY-MM-DD)');
      return;
    }

    let newStartAt: Date;
    if (editIsAllDay) {
      newStartAt = dayjs(editDate).startOf('day').toDate();
    } else {
      const h = parseInt(editHour, 10);
      const m = parseInt(editMinute, 10) || 0;
      if (isNaN(h) || h < 0 || h > 23) {
        Alert.alert('오류', '시(hour)를 0~23 사이로 입력해 주세요.');
        return;
      }
      newStartAt = dayjs(editDate).hour(h).minute(m).second(0).millisecond(0).toDate();
    }

    try {
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: {
          title: editTitle.trim(),
          startAt: Timestamp.fromDate(newStartAt),
          isAllDay: editIsAllDay,
          repeatType: editRepeatType,
        },
      });
      showToast('일정이 수정되었습니다.');
      setShowEditModal(false);
    } catch (error) {
      showError(error);
    }
  }, [schedule, editTitle, editDate, editHour, editMinute, editIsAllDay, editRepeatType, updateMutation]);

  // 관련(같은 제목) 일정
  const { data: relatedSchedules, isLoading: relatedLoading } = useRelatedSchedules(
    schedule?.title,
    schedule?.id,
  );

  // 해당 날짜 브리핑
  const { data: digest, isLoading: digestLoading } = useDateDigest(dateKey);

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

  /** 재알림: 1년 뒤 */
  const handleReminderNextYear = useCallback(async () => {
    if (!schedule?.id) return;
    try {
      const notifId = await scheduleReminderNextYear(schedule.id, schedule.title, startAt);
      await updateMutation.mutateAsync({
        id: schedule.id,
        data: { notificationId: notifId },
      });
      showToast('1년 뒤 재알림 설정');
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
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text, flex: 1 }]}>{schedule.title}</Text>
            <TouchableOpacity onPress={handleOpenEdit} style={styles.editIconBtn}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.divider }]}>
            <View style={styles.labelRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>날짜/시간</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>
              {schedule.isAllDay
                ? dayjs(startAt).format('YYYY년 M월 D일 (ddd)') + ' (하루 종일)'
                : dayjs(startAt).format('YYYY년 M월 D일 (ddd) HH:mm')}
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
          <TouchableOpacity
            style={[styles.reminderBtn, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={handleReminderNextYear}
          >
            <Text style={[styles.reminderBtnText, { color: colors.primary }]}>1년 뒤</Text>
          </TouchableOpacity>
        </Card>

        {/* 관련 일정 (같은 제목) */}
        {relatedLoading ? null : relatedSchedules && relatedSchedules.length > 0 ? (
          <View>
            <View style={styles.sectionHeader}>
              <Ionicons name="link-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                관련 일정 ({relatedSchedules.length})
              </Text>
            </View>
            {relatedSchedules.map((s) => (
              <ScheduleItem key={s.id} schedule={s} />
            ))}
          </View>
        ) : null}

        {/* 해당 날짜 브리핑 */}
        {digestLoading ? null : digest ? (
          <View>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                {dayjs(dateKey).format('M월 D일')} 브리핑
              </Text>
            </View>
            <Card style={styles.digestCard}>
              <Text style={[styles.digestBriefTitle, { color: colors.text }]}>{digest.title}</Text>
              <Text style={[styles.digestBriefSummary, { color: colors.textSecondary }]}>
                {digest.summary}
              </Text>
              <TouchableOpacity
                style={[styles.viewBriefingBtn, { borderColor: colors.primary }]}
                onPress={() => router.push(`/(tabs)/briefing?date=${dateKey}`)}
              >
                <Ionicons name="open-outline" size={14} color={colors.primary} />
                <Text style={[styles.viewBriefingBtnText, { color: colors.primary }]}>전체 브리핑 보기</Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : null}

        {/* 삭제 */}
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.surface, borderColor: colors.danger }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.deleteBtnText, { color: colors.danger }]}>일정 삭제</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── 수정 모달 ── */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>일정 수정</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 제목 */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>제목</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="일정 제목"
                placeholderTextColor={colors.textTertiary}
              />

              {/* 날짜 */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>날짜 (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="2026-03-15"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />

              {/* 하루 종일 */}
              <View style={styles.switchRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>하루 종일</Text>
                <Switch
                  value={editIsAllDay}
                  onValueChange={handleAllDayToggle}
                  trackColor={{ false: colors.inputBorder, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* 시간 (하루종일 아닐 때) */}
              {!editIsAllDay && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>시간</Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                      value={editHour}
                      onChangeText={setEditHour}
                      placeholder="시 (0~23)"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                    <Text style={[styles.timeSep, { color: colors.textSecondary }]}>:</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                      value={editMinute}
                      onChangeText={setEditMinute}
                      placeholder="분 (0~59)"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                </>
              )}

              {/* 반복 타입 */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>반복</Text>
              <View style={styles.repeatRow}>
                {(['none', 'monthly', 'yearly'] as RepeatType[]).map((rt) => (
                  <TouchableOpacity
                    key={rt}
                    style={[
                      styles.repeatBtn,
                      { borderColor: editRepeatType === rt ? colors.primary : colors.inputBorder,
                        backgroundColor: editRepeatType === rt ? colors.primary : colors.inputBackground },
                    ]}
                    onPress={() => setEditRepeatType(rt)}
                  >
                    <Text style={[styles.repeatBtnText, { color: editRepeatType === rt ? '#fff' : colors.textSecondary }]}>
                      {REPEAT_LABEL[rt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              <Text style={styles.saveBtnText}>
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingVertical: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  editIconBtn: {
    padding: 4,
    marginLeft: 8,
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

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },

  digestCard: { marginTop: 0 },
  relatedDesc: { fontSize: 12, marginBottom: 8 },
  digestBriefTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  digestBriefSummary: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  viewBriefingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  viewBriefingBtnText: { fontSize: 13, fontWeight: '600' },

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

  // ── 수정 모달 ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalBody: {
    flexGrow: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'center',
  },
  timeSep: {
    fontSize: 18,
    fontWeight: '600',
  },
  repeatRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  repeatBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  repeatBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
