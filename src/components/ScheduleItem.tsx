/**
 * 일정 아이템 카드
 */
import { dayjs } from '@/src/lib/time';
import type { ScheduleDoc } from '@/src/types';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  schedule: ScheduleDoc;
}

const REPEAT_LABEL: Record<string, string> = {
  none: '',
  monthly: '🔄 매월',
  yearly: '🔄 매년',
};

export function ScheduleItem({ schedule }: Props) {
  const startAt = schedule.startAt?.toDate?.() ?? new Date();
  const time = dayjs(startAt).format('HH:mm');
  const dateStr = dayjs(startAt).format('M월 D일 (ddd)');

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => router.push(`/schedule/${schedule.id}`)}
    >
      <View style={styles.timeCol}>
        <Text style={styles.time}>{time}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {schedule.title}
        </Text>
        <Text style={styles.date}>
          {dateStr}
          {REPEAT_LABEL[schedule.repeatType] ? `  ${REPEAT_LABEL[schedule.repeatType]}` : ''}
        </Text>
      </View>
      {schedule.notificationEnabled && <Text style={styles.bell}>🔔</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  timeCol: {
    width: 52,
    marginRight: 12,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    color: '#888',
  },
  bell: {
    fontSize: 16,
    marginLeft: 8,
  },
});
