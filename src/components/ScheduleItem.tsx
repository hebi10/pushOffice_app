/**
 * 일정 아이템 카드
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import { dayjs } from '@/src/lib/time';
import type { ScheduleDoc } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  schedule: ScheduleDoc;
}

const REPEAT_LABEL: Record<string, string> = {
  none: '',
  monthly: '매월 반복',
  yearly: '매년 반복',
};

export function ScheduleItem({ schedule }: Props) {
  const { colors } = useTheme();
  const startAt = schedule.startAt?.toDate?.() ?? new Date();
  const time = dayjs(startAt).format('HH:mm');
  const dateStr = dayjs(startAt).format('M월 D일 (ddd)');

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
      ]}
      activeOpacity={0.7}
      onPress={() => router.push(`/schedule/${schedule.id}`)}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: colors.primary }]}>{time}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {schedule.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{dateStr}</Text>
          {REPEAT_LABEL[schedule.repeatType] !== '' && (
            <View style={styles.repeatBadge}>
              <Ionicons name="repeat-outline" size={11} color={colors.textTertiary} />
              <Text style={[styles.repeatText, { color: colors.textTertiary }]}>
                {REPEAT_LABEL[schedule.repeatType]}
              </Text>
            </View>
          )}
        </View>
      </View>
      {schedule.notificationEnabled && (
        <Ionicons name="notifications-outline" size={16} color={colors.textTertiary} style={styles.bell} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeCol: {
    width: 52,
    marginRight: 12,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 12,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  repeatText: {
    fontSize: 11,
  },
  bell: {
    marginLeft: 8,
  },
});
