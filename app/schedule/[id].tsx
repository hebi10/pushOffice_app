import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SchedulePickerDialog } from '@/src/components/schedule/SchedulePickerDialog';
import { SchedulePickerField } from '@/src/components/schedule/SchedulePickerField';
import { EmptyState } from '@/src/components/EmptyState';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { AssistantButton, AssistantCard, AssistantTextField, SettingRow, assistantStyles as s } from '@/src/components/AssistantUI';
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
  const [pendingDialog, setPendingDialog] = useState<'repeat' | 'delete' | 'invalid-time' | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');

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
      setPendingDialog('repeat');
    } else {
      void save();
    }
  };

  const openDatePicker = (target: 'start' | 'end') => {
    setPickerTarget(target);
    setDateOpen(true);
  };

  const openTimePicker = (target: 'start' | 'end') => {
    setPickerTarget(target);
    const source = target === 'start' ? time : (end.trim().split(' ')[1] || time);
    const [h = '00', m = '00'] = source.split(':');
    setHour(h);
    setMinute(m);
    setTimeOpen(true);
  };

  const field = (label: string, value: string, onChangeText: (next: string) => void, placeholder?: string) => (
    <AssistantTextField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );

  const overviewEndDate = end.trim() ? dayjs(end.replace(' ', 'T')) : null;
  const overviewEnd = overviewEndDate?.isValid()
    ? overviewEndDate.format(allDay ? 'YYYY년 M월 D일 (ddd)' : 'YYYY년 M월 D일 (ddd) HH:mm')
    : end;

  if (!detail.data) {
    return (
      <View style={[s.content, styles.missingScreen, { backgroundColor: colors.background }]}>
        <ScreenIntro
          eyebrow="PUSH OFFICE · 일정"
          title="일정 상세"
          description="기기에 저장된 일정의 상세 정보를 확인합니다."
        />
        {detail.isLoading ? (
          <View style={styles.missingContent}>
            <ActivityIndicator accessibilityLabel="일정 불러오는 중" size="large" color={colors.primary} />
            <Text style={[s.body, { color: colors.textSecondary }]}>일정을 불러오는 중입니다.</Text>
          </View>
        ) : (
          <EmptyState message={detail.isError
            ? '일정을 불러오지 못했습니다. 다시 확인해 주세요.'
            : '일정을 찾을 수 없습니다. 삭제되었을 수 있습니다.'}
          />
        )}
        <AssistantButton label="일정 목록으로 돌아가기" icon="arrow-back-outline" secondary onPress={() => router.back()} />
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
        <ScreenIntro title="일정 관리" compact />
        <View accessibilityRole="summary" style={[styles.scheduleOverview, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.overviewTitle, { color: colors.text }]} numberOfLines={3}>{title || '제목 없는 일정'}</Text>
          <Text style={[styles.overviewTime, { color: colors.textSecondary }]}>
            {date ? dayjs(date).format('YYYY년 M월 D일 (ddd)') : '날짜 미지정'}
            {' · '}{allDay ? '종일' : time}
          </Text>
          {end ? (
            <Text style={[styles.overviewTime, { color: colors.textSecondary }]}>종료 {overviewEnd}</Text>
          ) : null}
          <Text style={[styles.overviewMeta, { color: colors.textSecondary }]}>
            {repeat === 'monthly' ? '매월 반복' : repeat === 'yearly' ? '매년 반복' : '반복 없음'}
            {' · '}{notification ? '알림 사용' : '알림 끔'}
          </Text>
        </View>
        <AssistantCard title="기본 정보" icon="create-outline">
          {field('제목', title, setTitle)}
        </AssistantCard>

        <AssistantCard title="날짜와 시간" icon="calendar-outline">
          <SchedulePickerField
            label="시작 날짜"
            accessibilityLabel="일정 날짜 선택"
            value={date ? dayjs(date).format('YYYY년 M월 D일') : '날짜 선택'}
            icon="calendar-outline"
            onPress={() => openDatePicker('start')}
          />
          <SettingRow title="하루 종일" description="시간 없이 하루 전체를 표시합니다." value={allDay} onValueChange={setAllDay} />
          {!allDay ? (
            <SchedulePickerField
              label="시작 시간"
              accessibilityLabel="시작 시간 선택"
              value={time}
              icon="time-outline"
              onPress={() => openTimePicker('start')}
            />
          ) : null}
          <Text style={[styles.groupCaption, { color: colors.textSecondary }]}>종료 날짜·시간 (선택)</Text>
          <View style={styles.endRow}>
            <View style={styles.endField}>
              <SchedulePickerField
                label="종료 날짜"
                accessibilityLabel="종료 날짜 선택"
                value={end ? dayjs(end.split(' ')[0]).format('YYYY년 M월 D일') : '날짜 선택'}
                icon="calendar-outline"
                onPress={() => openDatePicker('end')}
              />
            </View>
            <View style={styles.endField}>
              <SchedulePickerField
                label="종료 시간"
                accessibilityLabel="종료 시간 선택"
                value={end ? end.split(' ')[1] : '시간 선택'}
                icon="time-outline"
                onPress={() => openTimePicker('end')}
              />
            </View>
          </View>
          {end ? (
            <AssistantButton label="종료 시간 제거" icon="close-circle-outline" secondary onPress={() => setEnd('')} />
          ) : null}
        </AssistantCard>

        <AssistantCard title="반복과 알림" icon="repeat-outline" subtitle="반복 변경은 모든 해당 일정에 적용됩니다.">
          <Text style={[styles.groupCaption, { color: colors.textSecondary }]}>반복 주기</Text>
          {([['none', '반복 안 함'], ['monthly', '매월 반복'], ['yearly', '매년 반복']] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: repeat === key }}
              onPress={() => setRepeat(key)}
              style={[
                styles.repeatChoice,
                {
                  borderColor: repeat === key ? colors.primary : colors.inputBorder,
                  backgroundColor: repeat === key ? colors.primaryLight : colors.surface,
                },
              ]}
            >
              <Text style={[styles.repeatLabel, { color: colors.text }]}>{label}</Text>
              <Ionicons
                name={repeat === key ? 'radio-button-on' : 'radio-button-off'}
                color={repeat === key ? colors.primary : colors.textTertiary}
                size={22}
              />
            </TouchableOpacity>
          ))}
          <SettingRow
            title="일정 알림"
            description="기기 알림 권한과 전체 알림 설정에 따라 전달됩니다."
            value={notification}
            onValueChange={setNotification}
          />
        </AssistantCard>
        <AssistantButton
          label="변경 사항 저장"
          icon="checkmark-outline"
          busy={update.isPending}
          disabled={remove.isPending}
          onPress={confirmSave}
        />

        <AssistantCard title="재알림" icon="alarm-outline" subtitle="기존 일정은 변경하지 않고 다시 알립니다.">
          <AssistantButton label="10분 뒤 다시 알림" icon="alarm-outline" secondary onPress={() =>
            PushOfficeNative.snoozeSchedule(id, 10).then(() => showToast('10분 뒤 재알림을 예약했습니다.')).catch(e => showError(e, '예약하지 못했습니다.'))
          } />
          <AssistantButton label="재알림 취소" icon="close-outline" secondary onPress={() =>
            PushOfficeNative.cancelSnooze(id).then(() => showToast('재알림을 취소했습니다.')).catch(e => showError(e, '취소하지 못했습니다.'))
          } />
        </AssistantCard>
        <AssistantCard title="삭제 전 확인" icon="trash-outline" subtitle="일정과 연결된 알림도 함께 삭제됩니다.">
          <AssistantButton
            label={detail.data.repeatType === 'none' ? '일정 삭제' : '전체 반복 일정 삭제'}
            icon="trash-outline"
            variant="destructive"
            busy={remove.isPending}
            disabled={update.isPending}
            onPress={() => setPendingDialog('delete')}
          />
        </AssistantCard>
      </ScrollView>

      <SchedulePickerDialog
        visible={dateOpen}
        title={pickerTarget === 'start' ? '시작 날짜 선택' : '종료 날짜 선택'}
        description="날짜를 선택하면 수정 화면으로 돌아갑니다."
        onDismiss={() => setDateOpen(false)}
      >
        <Calendar
          key={isDark ? 'dark' : 'light'}
          current={(pickerTarget === 'start' ? date : end.split(' ')[0] || date) || undefined}
          onDayPress={day => {
            if (pickerTarget === 'start') {
              setDate(day.dateString);
            } else {
              setEnd(day.dateString + ' ' + (end.trim().split(' ')[1] || time));
            }
            setDateOpen(false);
          }}
          markedDates={(pickerTarget === 'start' ? date : end.split(' ')[0])
            ? { [(pickerTarget === 'start' ? date : end.split(' ')[0])]: { selected: true, selectedColor: colors.primary } }
            : {}}
          theme={{
            calendarBackground: colors.surface,
            dayTextColor: colors.text,
            monthTextColor: colors.text,
            arrowColor: colors.primary,
            todayTextColor: colors.primary,
            textDisabledColor: colors.textTertiary,
            selectedDayTextColor: colors.onPrimary,
          }}
        />
        <AssistantButton label="닫기" secondary icon="close-outline" onPress={() => setDateOpen(false)} />
      </SchedulePickerDialog>

      <SchedulePickerDialog
        visible={timeOpen}
        title={pickerTarget === 'start' ? '시작 시간 선택' : '종료 시간 선택'}
        description="시간은 0–23시, 분은 0–59분으로 입력해 주세요."
        onDismiss={() => setTimeOpen(false)}
      >
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={[styles.groupCaption, { color: colors.textSecondary }]}>시</Text>
            <TextInput
              accessibilityLabel="시"
              keyboardType="number-pad"
              maxLength={2}
              value={hour}
              onChangeText={setHour}
              style={[s.input, styles.timeInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
            />
          </View>
          <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
          <View style={styles.timeField}>
            <Text style={[styles.groupCaption, { color: colors.textSecondary }]}>분</Text>
            <TextInput
              accessibilityLabel="분"
              keyboardType="number-pad"
              maxLength={2}
              value={minute}
              onChangeText={setMinute}
              style={[s.input, styles.timeInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
            />
          </View>
        </View>
        <AssistantButton label="시간 적용" icon="checkmark-outline" onPress={() => {
          const h = Number(hour), m = Number(minute);
          if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) {
            setPendingDialog('invalid-time');
            return;
          }
          const formatted = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
          if (pickerTarget === 'start') {
            setTime(formatted);
          } else {
            setEnd((end.split(' ')[0] || date) + ' ' + formatted);
          }
          setTimeOpen(false);
        }} />
        <AssistantButton label="취소" icon="close-outline" secondary onPress={() => setTimeOpen(false)} />
      </SchedulePickerDialog>

      <AppDialog
        visible={pendingDialog === 'repeat'}
        title="반복 일정 전체 수정"
        message="변경 사항이 이 일정의 모든 반복에 적용됩니다. 날짜를 바꾸면 반복 기준일도 변경됩니다."
        confirmLabel="전체 수정"
        onDismiss={() => setPendingDialog(null)}
        onConfirm={() => { setPendingDialog(null); void save(); }}
      />
      <AppDialog
        visible={pendingDialog === 'delete'}
        title={detail.data.repeatType === 'none' ? '일정 삭제' : '전체 반복 일정 삭제'}
        message={detail.data.repeatType === 'none' ? '일정과 알림을 삭제합니다. 이 작업은 되돌릴 수 없습니다.' : '전체 반복 일정과 모든 알림을 삭제합니다. 이 작업은 되돌릴 수 없습니다.'}
        confirmLabel="삭제"
        destructive
        onDismiss={() => setPendingDialog(null)}
        onConfirm={() => {
          setPendingDialog(null);
          void remove.mutateAsync(id).then(() => router.back()).catch(e => showError(e, '삭제하지 못했습니다.'));
        }}
      />
      <AppDialog
        visible={pendingDialog === 'invalid-time'}
        title="시간 확인"
        message="시는 0–23, 분은 0–59 범위로 입력해 주세요."
        showCancel={false}
        onDismiss={() => setPendingDialog(null)}
        onConfirm={() => setPendingDialog(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scheduleOverview: { padding: uiSpacing.md, gap: uiSpacing.xs, borderRadius: uiRadii.card, borderWidth: uiSizes.borderWidth },
  overviewTitle: { ...uiTypography.sectionTitle, fontSize: 20, lineHeight: 28 },
  overviewTime: { ...uiTypography.body, fontVariant: ['tabular-nums'] },
  overviewMeta: { ...uiTypography.caption, paddingTop: uiSpacing.xxs },
  missingScreen: { flex: 1 },
  missingContent: {
    paddingVertical: uiSpacing.xxl,
    gap: uiSpacing.sm,
    alignItems: 'center',
  },
  groupCaption: uiTypography.caption,
  endRow: { flexDirection: 'row', flexWrap: 'wrap', gap: uiSpacing.xs },
  endField: { flexGrow: 1, flexBasis: 138, minWidth: 0 },
  repeatChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: uiSpacing.sm,
    minHeight: uiSizes.controlMinHeight,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.field,
  },
  repeatLabel: { ...uiTypography.body, flex: 1, minWidth: 0 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.sm },
  timeField: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  timeSeparator: { ...uiTypography.sectionTitle, paddingTop: uiSpacing.md },
  timeInput: { minWidth: 0, textAlign: 'center' },
});
