import { useTheme } from '@/src/contexts/ThemeContext';
import { dayjs } from '@/src/lib/time';
import { APP_FONT_FAMILY } from '@/src/lib/typography';
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

export function ScheduleItem({ schedule }: { schedule: ScheduleDoc }) {
  const { colors } = useTheme();
  const startAt = schedule.startAt?.toDate?.() ?? new Date();
  const time = schedule.isAllDay ? '종일' : dayjs(startAt).format('HH:mm');
  const dateStr = dayjs(startAt).format('M월 D일 (ddd)');
  const repeatLabel = REPEAT_LABEL[schedule.repeatType] ?? '';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${schedule.title}, ${dateStr} ${time}, 일정 상세`}
      activeOpacity={0.8}
      onPress={() => router.push(`/schedule/${schedule.id}`)}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: colors.primary }]}>{time}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{schedule.title}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{dateStr}</Text>
          {repeatLabel ? (
            <View style={styles.repeat}>
              <Ionicons name="repeat-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.date, { color: colors.textSecondary }]}>{repeatLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {schedule.notificationEnabled ? (
        <Ionicons name="notifications-outline" size={16} color={colors.textSecondary} />
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', minHeight: 68,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  timeCol: { width: 50 },
  time: { fontFamily: APP_FONT_FAMILY, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  content: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontFamily: APP_FONT_FAMILY, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  date: { fontFamily: APP_FONT_FAMILY, fontSize: 12, lineHeight: 16 },
  repeat: { flexDirection: 'row', gap: 3, alignItems: 'center' },
});
