/**
 * Calendar 화면 – 월간 달력 + 일정 리스트 + 빠른 추가
 */
import { EmptyState } from '@/src/components/EmptyState';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { showError, showToast } from '@/src/components/ui/toast';
import { canScheduleMore, scheduleNotification } from '@/src/features/notifications';
import { useCreateSchedule, useMonthSchedules } from '@/src/features/schedules';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import type { RepeatType, ScheduleDoc } from '@/src/types';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CalendarScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const tz = useAppSelector((s) => s.settings.timezone);

  const today = dayjs().format('YYYY-MM-DD');
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);

  const { data: schedules, isLoading } = useMonthSchedules(currentYear, currentMonth);
  const createMutation = useCreateSchedule();

  // 빠른 추가 모달
  const [showModal, setShowModal] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickHour, setQuickHour] = useState('9');
  const [quickMinute, setQuickMinute] = useState('0');

  // 마킹: 일정이 있는 날짜에 dot
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    (schedules ?? []).forEach((s) => {
      const dateKey = dayjs(s.startAt?.toDate?.()).format('YYYY-MM-DD');
      if (!marks[dateKey]) {
        marks[dateKey] = { marked: true, dotColor: '#4A90D9' };
      }
    });

    // 선택된 날짜
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: '#4A90D9',
      selectedTextColor: '#FFF',
    };

    return marks;
  }, [schedules, selectedDate]);

  // 선택된 날짜의 일정
  const daySchedules = useMemo<ScheduleDoc[]>(() => {
    if (!schedules) return [];
    return schedules.filter((s) => {
      const dateKey = dayjs(s.startAt?.toDate?.()).format('YYYY-MM-DD');
      return dateKey === selectedDate;
    });
  }, [schedules, selectedDate]);

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

    const hour = parseInt(quickHour, 10) || 9;
    const minute = parseInt(quickMinute, 10) || 0;
    const startAt = dayjs(selectedDate).hour(hour).minute(minute).second(0).toDate();

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
        title: quickTitle.trim(),
        startAt,
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
    } catch (error) {
      showError(error, '일정 추가에 실패했습니다.');
    }
  }, [uid, quickTitle, quickHour, quickMinute, selectedDate, createMutation]);

  if (isLoading) return <Loading />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 캘린더 */}
      <Calendar
        current={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`}
        onMonthChange={handleMonthChange}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        theme={{
          backgroundColor: '#F5F5F5',
          calendarBackground: '#FAFAFA',
          todayTextColor: '#4A90D9',
          arrowColor: '#4A90D9',
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
          selectedDayBackgroundColor: '#4A90D9',
          dotColor: '#4A90D9',
        }}
      />

      {/* 구분선 */}
      <View style={styles.divider} />

      {/* 선택된 날짜 헤더 */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateHeaderText}>
          {dayjs(selectedDate).format('M월 D일 (ddd)')}
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.addBtnText}>+ 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 일정 리스트 */}
      <FlatList
        data={daySchedules}
        keyExtractor={(item) => item.id ?? ''}
        renderItem={({ item }) => <ScheduleItem schedule={item} />}
        ListEmptyComponent={<EmptyState message="이 날짜의 일정이 없습니다." />}
        contentContainerStyle={styles.listContent}
      />

      {/* 빠른 추가 모달 */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>빠른 일정 추가</Text>
            <Text style={styles.modalDate}>
              {dayjs(selectedDate).format('YYYY년 M월 D일')}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="일정 제목"
              placeholderTextColor="#BBB"
              value={quickTitle}
              onChangeText={setQuickTitle}
              autoFocus
            />

            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                placeholder="시"
                placeholderTextColor="#BBB"
                value={quickHour}
                onChangeText={setQuickHour}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeSep}>:</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="분"
                placeholderTextColor="#BBB"
                value={quickMinute}
                onChangeText={setQuickMinute}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleQuickAdd}>
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
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#DDD',
    marginHorizontal: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateHeaderText: { fontSize: 15, fontWeight: '600', color: '#333' },
  addBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  listContent: { paddingBottom: 16 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 4 },
  modalDate: { fontSize: 13, color: '#888', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
  timeSep: { fontSize: 20, marginHorizontal: 8, color: '#666' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelBtnText: { color: '#666', fontSize: 14 },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#4A90D9',
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
