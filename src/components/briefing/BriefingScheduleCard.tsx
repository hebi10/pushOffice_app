/**
 * 일정 카드 – 오늘/내일 일정 미리보기
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import type { ScheduleDoc } from '@/src/types';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../Card';

interface Props {
  todaySchedules: ScheduleDoc[];
  tomorrowSchedules: ScheduleDoc[];
}

function formatTime(ts: unknown): string {
  if (!ts) return '';
  // Firestore Timestamp → Date
  const d = typeof (ts as { toDate?: () => Date })?.toDate === 'function'
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string | number);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function BriefingScheduleCard({ todaySchedules, tomorrowSchedules }: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const hasAny = todaySchedules.length > 0 || tomorrowSchedules.length > 0;
  if (!hasAny) return null;

  const renderRow = (item: ScheduleDoc) => (
    <Pressable
      key={item.id ?? item.title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      onPress={() => item.id && router.push(`/schedule/${item.id}`)}
    >
      <Text style={[styles.time, { color: colors.primary }]}>
        {formatTime(item.startAt)}
      </Text>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {item.title}
      </Text>
    </Pressable>
  );

  return (
    <Card>
      {todaySchedules.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            오늘 일정 ({todaySchedules.length})
          </Text>
          {todaySchedules.slice(0, 5).map(renderRow)}
        </>
      )}

      {tomorrowSchedules.length > 0 && (
        <>
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.textSecondary },
              todaySchedules.length > 0 && { marginTop: 12 },
            ]}
          >
            내일 일정 ({tomorrowSchedules.length})
          </Text>
          {tomorrowSchedules.slice(0, 3).map(renderRow)}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  time: { fontSize: 13, fontWeight: '600', width: 42 },
  title: { fontSize: 14, flex: 1 },
});
