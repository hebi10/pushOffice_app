/**
 * Calendar 화면 – 월간 달력 + 일정 리스트 + 브리핑 기록 + 빠른 추가
 */
import { EmptyState } from '@/src/components/EmptyState';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { showError, showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useMonthDigests } from '@/src/features/digest';
import { canScheduleMore, scheduleNotification } from '@/src/features/notifications';
import { useCreateSchedule, useMonthSchedules } from '@/src/features/schedules';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import type { DigestDoc, RepeatType, ScheduleDoc } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CalendarScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const tz = useAppSelector((s) => s.settings.timezone);
  const { colors, isDark } = useTheme();

  const today = dayjs().format('YYYY-MM-DD');
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);

  const { data: schedules, isLoading } = useMonthSchedules(currentYear, currentMonth);
  const { data: digests } = useMonthDigests(currentYear, currentMonth);
  const createMutation = useCreateSchedule();

  // 빠른 추가 모달
  const [showModal, setShowModal] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickHour, setQuickHour] = useState('9');
  const [quickMinute, setQuickMinute] = useState('0');
  const [quickIsAllDay, setQuickIsAllDay] = useState(false);
  const [quickEndHour, setQuickEndHour] = useState('');
  const [quickEndMinute, setQuickEndMinute] = useState('');

  // 마킹: 일정 dot(파란색) + 브리핑 dot(초록색)
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    (schedules ?? []).forEach((s) => {
      const dateKey = dayjs(s.startAt?.toDate?.()).format('YYYY-MM-DD');
      if (!marks[dateKey]) {
        marks[dateKey] = { dots: [] };
      }
      if (!marks[dateKey].dots.find((d: any) => d.key === 'schedule')) {
        marks[dateKey].dots.push({ key: 'schedule', color: colors.primary });
      }
    });

    (digests ?? []).forEach((d) => {
      if (!marks[d.dateKey]) {
        marks[d.dateKey] = { dots: [] };
      }
      if (!marks[d.dateKey].dots.find((dt: any) => dt.key === 'digest')) {
        marks[d.dateKey].dots.push({ key: 'digest', color: colors.success });
      }
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] || { dots: [] }),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: '#FFF',
    };

    return marks;
  }, [schedules, digests, selectedDate, colors]);

  const daySchedules = useMemo<ScheduleDoc[]>(() => {
    if (!schedules) return [];
    return schedules.filter((s) => {
      const dateKey = dayjs(s.startAt?.toDate?.()).format('YYYY-MM-DD');
      return dateKey === selectedDate;
    });
  }, [schedules, selectedDate]);

  const dayDigests = useMemo<DigestDoc[]>(() => {
    if (!digests) return [];
    return digests.filter((d) => d.dateKey === selectedDate);
  }, [digests, selectedDate]);

  const handleMonthChange = useCallback((date: DateData) => {
    setCurrentYear(date.year);
    setCurrentMonth(date.month);
  }, []);

  const handleDayPress = useCallback((date: DateData) => {
    setSelectedDate(date.dateString);
  }, []);

  /** 빠른 일정 추가 */
  const handleQuickAdd = useCallback(async () => {
    if (!uid || !quickTitle.trim()) {
      Alert.alert('알림', '제목을 입력해 주세요.');
      return;
    }

    let startAt: Date;
    let endAt: Date | null = null;

    if (quickIsAllDay) {
      startAt = dayjs(selectedDate).startOf('day').toDate();
    } else {
      const hour = parseInt(quickHour, 10) || 9;
      const minute = parseInt(quickMinute, 10) || 0;
      startAt = dayjs(selectedDate).hour(hour).minute(minute).second(0).toDate();

      // 종료 시간이 입력된 경우
      if (quickEndHour.trim()) {
        const endH = parseInt(quickEndHour, 10) || 0;
        const endM = parseInt(quickEndMinute, 10) || 0;
        endAt = dayjs(selectedDate).hour(endH).minute(endM).second(0).toDate();
      }
    }

    try {
      const canSch = await canScheduleMore();
      let notificationId: string | null = null;

      if (canSch && startAt > new Date()) {
        try {
          notificationId = await scheduleNotification(
            quickTitle.trim(),
            `${dayjs(startAt).format('M월 D일 HH:mm')} 일정`,
            startAt,
            { route: '/(tabs)/calendar' },
          );
        } catch {
          // 알림 실패해도 진행
        }
      }

      await createMutation.mutateAsync({
        userId: uid,
        type: 'schedule' as const,
        title: quickTitle.trim(),
        startAt,
        endAt,
        isAllDay: quickIsAllDay,
        repeatType: 'none' as RepeatType,
        notificationEnabled: !!notificationId,
        notificationId,
        sourceText: quickTitle.trim(),
      });

      showToast('일정이 추가되었습니다.');
      setShowModal(false);
      setQuickTitle('');
      setQuickHour('9');
      setQuickMinute('0');
      setQuickIsAllDay(false);
      setQuickEndHour('');
      setQuickEndMinute('');
    } catch (error) {
      showError(error, '일정 추가에 실패했습니다.');
    }
  }, [uid, quickTitle, quickHour, quickMinute, quickIsAllDay, quickEndHour, quickEndMinute, selectedDate, createMutation]);

  if (isLoading) return <Loading />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* 캘린더 */}
      <Calendar
        current={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`}
        onMonthChange={handleMonthChange}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        markingType="multi-dot"
        key={isDark ? 'dark' : 'light'}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.surface,
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
          dayTextColor: colors.text,
          monthTextColor: colors.text,
          textSectionTitleColor: colors.textSecondary,
          textDisabledColor: colors.textTertiary,
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
          selectedDayBackgroundColor: colors.primary,
        }}
      />

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      {/* 선택된 날짜 헤더 */}
      <View style={styles.dateHeader}>
        <Text style={[styles.dateHeaderText, { color: colors.text }]}>
          {dayjs(selectedDate).format('M월 D일 (ddd)')}
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={14} color="#FFF" />
          <Text style={styles.addBtnText}>추가</Text>
        </TouchableOpacity>
      </View>

      {/* 일정 + 브리핑 리스트 */}
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>일정</Text>
            {daySchedules.length === 0 ? (
              <EmptyState message="이 날짜의 일정이 없습니다." />
            ) : (
              daySchedules.map((item) => (
                <ScheduleItem key={item.id} schedule={item} />
              ))
            )}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>브리핑 기록</Text>
            {dayDigests.length === 0 ? (
              <View style={styles.emptyDigest}>
                <Text style={[styles.emptyDigestText, { color: colors.textTertiary }]}>브리핑 기록 없음</Text>
                <TouchableOpacity
                  style={[styles.genBtn, { backgroundColor: colors.success }]}
                  onPress={() =>
                    router.push(`/(tabs)/briefing?date=${selectedDate}` as any)
                  }
                >
                  <Text style={styles.genBtnText}>브리핑 보기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              dayDigests.map((d) => (
                <TouchableOpacity
                  key={d.id || d.dateKey}
                  style={[styles.digestItem, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                  onPress={() =>
                    router.push(`/(tabs)/briefing?date=${d.dateKey}` as any)
                  }
                >
                  <View style={[styles.digestDot, { backgroundColor: colors.success }]} />
                  <View style={styles.digestContent}>
                    <Text style={[styles.digestTitle, { color: colors.text }]}>{d.title}</Text>
                    <Text style={[styles.digestSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                      {d.summary}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 빠른 추가 모달 */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>빠른 일정 추가</Text>
            <Text style={[styles.modalDate, { color: colors.textSecondary }]}>
              {dayjs(selectedDate).format('YYYY년 M월 D일')}
            </Text>

            <TextInput
              style={[styles.modalInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
              placeholder="일정 제목"
              placeholderTextColor={colors.textTertiary}
              value={quickTitle}
              onChangeText={setQuickTitle}
              autoFocus
            />

            {/* 하루 종일 토글 */}
            <View style={styles.allDayRow}>
              <Text style={[styles.allDayLabel, { color: colors.text }]}>하루 종일</Text>
              <Switch
                value={quickIsAllDay}
                onValueChange={setQuickIsAllDay}
                trackColor={{ false: colors.divider, true: colors.primary }}
              />
            </View>

            {/* 시간 입력 (하루 종일이 아닌 경우만) */}
            {!quickIsAllDay && (
              <>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>시작 시간</Text>
                <View style={styles.timeRow}>
                  <TextInput
                    style={[styles.timeInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                    placeholder="시"
                    placeholderTextColor={colors.textTertiary}
                    value={quickHour}
                    onChangeText={setQuickHour}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={[styles.timeSep, { color: colors.textSecondary }]}>:</Text>
                  <TextInput
                    style={[styles.timeInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                    placeholder="분"
                    placeholderTextColor={colors.textTertiary}
                    value={quickMinute}
                    onChangeText={setQuickMinute}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>종료 시간 (선택)</Text>
                <View style={styles.timeRow}>
                  <TextInput
                    style={[styles.timeInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                    placeholder="시"
                    placeholderTextColor={colors.textTertiary}
                    value={quickEndHour}
                    onChangeText={setQuickEndHour}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={[styles.timeSep, { color: colors.textSecondary }]}>:</Text>
                  <TextInput
                    style={[styles.timeInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                    placeholder="분"
                    placeholderTextColor={colors.textTertiary}
                    value={quickEndMinute}
                    onChangeText={setQuickEndMinute}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.inputBorder }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleQuickAdd}>
                <Text style={styles.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateHeaderText: { fontSize: 15, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  listContent: { paddingBottom: 16 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },

  emptyDigest: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyDigestText: { fontSize: 13, marginBottom: 8 },
  genBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  genBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  digestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  digestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  digestContent: { flex: 1 },
  digestTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  digestSummary: { fontSize: 12 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalDate: { fontSize: 13, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  allDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allDayLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
  },
  timeSep: { fontSize: 20, marginHorizontal: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14 },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
