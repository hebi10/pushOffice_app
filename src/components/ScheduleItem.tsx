import { useTheme } from '@/src/contexts/ThemeContext';
import { dayjs } from '@/src/lib/time';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
import type { ScheduleDoc } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const REPEAT_LABEL: Record<string, string> = {
  none: '',
  monthly: '매월 반복',
  yearly: '매년 반복',
};

export function ScheduleItem({ schedule, variant = 'default' }: { schedule: ScheduleDoc; variant?: 'default' | 'calendar' }) {
  const { colors } = useTheme();
  const calendar = variant === 'calendar';
  const startAt = schedule.startAt?.toDate?.() ?? new Date();
  const endAt = schedule.endAt?.toDate?.();
  const time = schedule.isAllDay ? '종일' : dayjs(startAt).format('HH:mm');
  const dateStr = dayjs(startAt).format('M월 D일 (ddd)');
  const repeatLabel = REPEAT_LABEL[schedule.repeatType] ?? '';
  const hasEnd = !schedule.isAllDay && !!endAt && endAt.getTime() > startAt.getTime();
  const sameDayEnd = !!endAt && dayjs(startAt).isSame(dayjs(endAt), 'day');
  const endLabel = hasEnd && endAt
    ? sameDayEnd ? `~ ${dayjs(endAt).format('HH:mm')}` : `~ ${dayjs(endAt).format('M/D HH:mm')}`
    : '';
  const showMeta = !calendar || Boolean(repeatLabel) || Boolean(endLabel && !sameDayEnd) || (calendar && schedule.notificationEnabled);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${schedule.title}, ${dateStr} ${time}${endLabel ? ` ${endLabel}` : ''}, 일정 상세`}
      accessibilityState={{ disabled: !schedule.id }}
      disabled={!schedule.id}
      activeOpacity={0.8}
      onPress={() => { if (schedule.id) router.push(`/schedule/${schedule.id}`); }}
      style={[styles.container, calendar ? styles.calendarContainer : null, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
    >
      <View style={[styles.accentRail, { backgroundColor: colors.primary }]} />
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: colors.primary }]}>{time}</Text>
        {endLabel && sameDayEnd ? (
          <Text style={[styles.endTime, { color: colors.textSecondary }]}>{endLabel}</Text>
        ) : null}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, calendar ? styles.calendarTitle : null, { color: colors.text }]} numberOfLines={calendar ? 3 : 2}>{schedule.title}</Text>
        {showMeta ? <View style={styles.metaRow}>
          {!calendar ? <Text style={[styles.date, { color: colors.textSecondary }]}>{dateStr}</Text> : null}
          {endLabel && !sameDayEnd ? (
            <Text style={[styles.date, { color: colors.textSecondary }]}>{endLabel}</Text>
          ) : null}
          {repeatLabel ? (
            <View style={styles.repeat}>
              <Ionicons name="repeat-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.date, { color: colors.textSecondary }]}>{repeatLabel}</Text>
            </View>
          ) : null}
          {calendar && schedule.notificationEnabled ? (
            <View style={styles.repeat}>
              <Ionicons name="notifications-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.date, { color: colors.textSecondary }]}>알림</Text>
            </View>
          ) : null}
        </View> : null}
      </View>
      <View style={styles.icons}>
        {!calendar && schedule.notificationEnabled ? (
          <Ionicons
            accessibilityLabel="알림 사용"
            name="notifications-outline"
            size={16}
            color={colors.textSecondary}
          />
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    borderRadius: uiRadii.field,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.xs,
    borderWidth: uiSizes.borderWidth,
    gap: uiSpacing.xs,
  },
  calendarContainer: { minHeight: 74, gap: uiSpacing.sm, paddingVertical: uiSpacing.sm },
  accentRail: { width: 3, alignSelf: 'stretch', borderRadius: uiRadii.field },
  timeCol: { width: 62, gap: uiSpacing.xxs },
  time: { ...uiTypography.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  endTime: { ...uiTypography.caption, fontVariant: ['tabular-nums'] },
  content: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  title: { ...uiTypography.body, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  calendarTitle: { fontSize: 15, lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: uiSpacing.xs },
  date: { ...uiTypography.caption },
  repeat: { flexDirection: 'row', gap: uiSpacing.xxs, alignItems: 'center' },
  icons: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs },
});
