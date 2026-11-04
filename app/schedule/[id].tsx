import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useScheduleDetail, useUpdateSchedule, useDeleteSchedule } from '@/src/features/schedules';
import { PushOfficeNative } from '@/modules/push-office-native';
import { dayjs } from '@/src/lib/time';
import { showError, showToast } from '@/src/components/ui/toast';
import type { RepeatType } from '@/src/types';

LocaleConfig.locales.ko = {
  monthNames: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
  monthNamesShort: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

export default function ScheduleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useScheduleDetail(id);
  const update = useUpdateSchedule();
  const remove = useDeleteSchedule();
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [end, setEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [notification, setNotification] = useState(true);
  const [repeat, setRepeat] = useState<RepeatType>('none');
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [hour, setHour] = useState('00');
  const [minute, setMinute] = useState('00');

  useEffect(() => {
    const record = detail.data;
    if (!record) return;
    setTitle(record.title);
    setDate(dayjs(record.startAt.toDate()).format('YYYY-MM-DD'));
    setTime(dayjs(record.startAt.toDate()).format('HH:mm'));
    setEnd(record.endAt ? dayjs(record.endAt.toDate()).format('YYYY-MM-DD HH:mm') : '');
    setAllDay(!!record.isAllDay);
    setNotification(record.notificationEnabled);
    setRepeat(record.repeatType);
  }, [detail.data]);

  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
      throw new Error('날짜는 YYYY-MM-DD, 시간은 HH:mm 형식으로 입력해 주세요.');
    }
    const result = new Date(value.replace(' ', 'T') + ':00');
    if (!Number.isFinite(result.getTime()) || dayjs(result).format('YYYY-MM-DD HH:mm') !== value) {
      throw new Error('실제 존재하는 날짜와 시간을 입력해 주세요.');
    }
    return result;
  };

  const save = async () => {
    try {
      const start = parse(`${date} ${allDay ? '00:00' : time}`);
      const finish = end.trim() ? parse(end.trim()) : null;
      await update.mutateAsync({
        id,
        data: {
          title, startAt: Timestamp.fromDate(start),
          endAt: finish ? Timestamp.fromDate(finish) : null,
          isAllDay: allDay, repeatType: repeat, notificationEnabled: notification,
        },
      });
      showToast('일정을 수정했습니다.');
    } catch (error) {
      showError(error, '저장하지 못했습니다.');
    }
  };

  const confirmSave = () => {
    if (detail.data?.repeatType !== 'none' || repeat !== 'none') {
      Alert.alert('반복 일정 전체 수정', '이 일정의 모든 반복에 적용됩니다. 원래 날짜를 바꾸면 반복 기준 날짜도 바뀝니다.', [
        { text: '취소', style: 'cancel' },
        { text: '전체 수정', onPress: () => { void save(); } },
      ]);
    } else {
      void save();
    }
  };

  const field = (label: string, value: string, onChangeText: (next: string) => void, placeholder?: string) => (
    <View style={{ gap: 6 }}>
      <Text style={[s.caption, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[s.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }]}
      />
    </View>
  );

  if (!detail.data) {
    return (
      <View style={s.content}>
        <Text style={{ color: colors.text }}>{detail.isLoading ? '일정을 불러오는 중…' : '일정을 찾을 수 없습니다. 삭제되었을 수 있습니다.'}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <AssistantCard title="일정 수정" icon="create-outline" subtitle="제목과 시간을 확인하고 필요한 항목만 수정하세요.">
          {field('제목', title, setTitle)}
          <View style={{ gap: 6 }}>
            <Text style={[s.caption, { color: colors.textSecondary }]}>날짜</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="일정 날짜 선택"
              onPress={() => setDateOpen(true)}
              style={[s.row, { borderWidth: 1, borderRadius: 10, borderColor: colors.inputBorder, backgroundColor: colors.background, paddingHorizontal: 12 }]}
            >
              <Ionicons name="calendar-outline" size={19} color={colors.primary} />
              <Text style={[s.body, { color: colors.text, flex: 1 }]}>{date ? dayjs(date).format('YYYY년 M월 D일') : '날짜 선택'}</Text>
              <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={s.row}>
            <Text style={[s.body, { color: colors.text }]}>하루 종일</Text>
            <Switch accessibilityLabel="하루 종일" value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.primary }} />
          </View>
          {!allDay ? (
            <View style={{ gap: 6 }}>
              <Text style={[s.caption, { color: colors.textSecondary }]}>시작 시간</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="시작 시간 선택"
                onPress={() => {
                  const [h = '00', m = '00'] = time.split(':');
                  setHour(h); setMinute(m); setTimeOpen(true);
                }}
                style={[s.row, { borderWidth: 1, borderRadius: 10, borderColor: colors.inputBorder, backgroundColor: colors.background, paddingHorizontal: 12 }]}
              >
                <Ionicons name="time-outline" size={19} color={colors.primary} />
                <Text style={[s.body, { color: colors.text, flex: 1 }]}>{time}</Text>
                <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}
          {field('종료 날짜와 시간 (선택)', end, setEnd, 'YYYY-MM-DD HH:mm')}
          <View style={s.row}>
            <Text style={[s.body, { color: colors.text }]}>일정 알림</Text>
            <Switch accessibilityLabel="일정 알림" value={notification} onValueChange={setNotification} trackColor={{ true: colors.primary }} />
          </View>
          <Text style={[s.caption, { color: colors.textSecondary }]}>알림은 기기 권한과 전체 알림 설정에 따라 전달됩니다.</Text>
          <Text style={[s.caption, { color: colors.textSecondary }]}>반복</Text>
          {([['none', '반복 안 함'], ['monthly', '매월 반복'], ['yearly', '매년 반복']] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: repeat === key }}
              onPress={() => setRepeat(key)}
              style={[s.row, { paddingHorizontal: 12, borderWidth: 1, borderColor: repeat === key ? colors.primary : colors.inputBorder, borderRadius: 10 }]}
            >
              <Text style={[s.body, { color: colors.text, flex: 1 }]}>{label}</Text>
              <Ionicons name={repeat === key ? 'radio-button-on' : 'radio-button-off'} color={repeat === key ? colors.primary : colors.textTertiary} size={20} />
            </TouchableOpacity>
          ))}
          <AssistantButton label="변경 사항 저장" icon="checkmark-outline" busy={update.isPending} onPress={confirmSave} />
        </AssistantCard>
        <AssistantCard title="재알림" icon="alarm-outline">
          <Text style={[s.caption, { color: colors.textSecondary }]}>반복 기준 날짜를 바꾸지 않고 한 번 더 알려드립니다.</Text>
          <AssistantButton label="10분 뒤 다시 알림" icon="alarm-outline" secondary onPress={() =>
            PushOfficeNative.snoozeSchedule(id, 10).then(() => showToast('10분 뒤 재알림을 예약했습니다.')).catch(e => showError(e, '예약하지 못했습니다.'))
          } />
          <AssistantButton label="재알림 취소" icon="close-outline" secondary onPress={() =>
            PushOfficeNative.cancelSnooze(id).then(() => showToast('재알림을 취소했습니다.')).catch(e => showError(e, '취소하지 못했습니다.'))
          } />
        </AssistantCard>
        <AssistantButton
          label={detail.data.repeatType === 'none' ? '일정 삭제' : '전체 반복 일정 삭제'}
          icon="trash-outline"
          secondary
          busy={remove.isPending}
          onPress={() => Alert.alert(
            '일정 삭제',
            detail.data?.repeatType === 'none' ? '일정과 알림을 삭제합니다.' : '전체 반복 일정과 모든 알림을 삭제합니다.',
            [
              { text: '취소', style: 'cancel' },
              { text: '삭제', style: 'destructive', onPress: () => remove.mutateAsync(id).then(() => router.back()).catch(e => showError(e, '삭제하지 못했습니다.')) },
            ],
          )}
        />
      </ScrollView>
      <Modal transparent animationType="fade" visible={dateOpen} onRequestClose={() => setDateOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.48)' }}>
          <View style={{ borderRadius: 16, backgroundColor: colors.surface, padding: 16, gap: 12 }}>
            <Text style={[s.body, { color: colors.text, fontWeight: '700' }]}>일정 날짜 선택</Text>
            <Calendar
              key={isDark ? 'dark' : 'light'}
              current={date || undefined}
              onDayPress={day => { setDate(day.dateString); setDateOpen(false); }}
              markedDates={date ? { [date]: { selected: true, selectedColor: colors.primary } } : {}}
              theme={{
                calendarBackground: colors.surface, dayTextColor: colors.text,
                monthTextColor: colors.text, arrowColor: colors.primary,
                todayTextColor: colors.primary, textDisabledColor: colors.textTertiary,
                selectedDayTextColor: '#FFFFFF',
              }}
            />
            <AssistantButton label="닫기" secondary icon="close-outline" onPress={() => setDateOpen(false)} />
          </View>
        </View>
      </Modal>
      <Modal transparent animationType="fade" visible={timeOpen} onRequestClose={() => setTimeOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.48)' }}>
          <View style={{ borderRadius: 16, backgroundColor: colors.surface, padding: 20, gap: 14 }}>
            <Text style={[s.body, { color: colors.text, fontWeight: '700' }]}>시작 시간 선택</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput
                accessibilityLabel="시"
                keyboardType="number-pad"
                maxLength={2}
                value={hour}
                onChangeText={setHour}
                style={[s.input, { flex: 1, color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }]}
              />
              <Text style={{ color: colors.text, fontWeight: '700' }}>:</Text>
              <TextInput
                accessibilityLabel="분"
                keyboardType="number-pad"
                maxLength={2}
                value={minute}
                onChangeText={setMinute}
                style={[s.input, { flex: 1, color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }]}
              />
            </View>
            <AssistantButton label="시간 적용" icon="checkmark-outline" onPress={() => {
              const h = Number(hour), m = Number(minute);
              if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) {
                Alert.alert('시간 확인', '0–23시, 0–59분으로 입력해 주세요.');
                return;
              }
              setTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
              setTimeOpen(false);
            }} />
            <AssistantButton label="취소" icon="close-outline" secondary onPress={() => setTimeOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
