/**
 * Briefing 화면 – 날씨 + 오늘/내일 일정
 */
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { useSchedules } from '@/src/features/schedules';
import { useWeather } from '@/src/features/weather';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BriefingScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const { data: schedules, isLoading: schedulesLoading } = useSchedules();
  const { data: weather, isLoading: weatherLoading } = useWeather();

  const todayStart = dayjs().startOf('day');
  const todayEnd = dayjs().endOf('day');
  const tomorrowStart = dayjs().add(1, 'day').startOf('day');
  const tomorrowEnd = dayjs().add(1, 'day').endOf('day');

  const todaySchedules = (schedules ?? []).filter((s) => {
    const d = dayjs(s.startAt?.toDate?.());
    return d.isAfter(todayStart) && d.isBefore(todayEnd);
  });

  const tomorrowSchedules = (schedules ?? []).filter((s) => {
    const d = dayjs(s.startAt?.toDate?.());
    return d.isAfter(tomorrowStart) && d.isBefore(tomorrowEnd);
  });

  if (schedulesLoading) return <Loading />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            {/* 날씨 */}
            <Card style={styles.weatherCard}>
              {weatherLoading ? (
                <Text style={styles.weatherLoading}>날씨 불러오는 중...</Text>
              ) : weather ? (
                <View style={styles.weatherRow}>
                  <Text style={styles.weatherIcon}>
                    {weather.icon.includes('d') ? '☀️' : '🌙'}
                  </Text>
                  <View style={styles.weatherInfo}>
                    <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
                    <Text style={styles.weatherDesc}>
                      {weather.city} · {weather.description}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.weatherLoading}>날씨 정보를 불러올 수 없습니다.</Text>
              )}
            </Card>

            {/* 오늘 일정 */}
            <Text style={styles.sectionTitle}>📌 오늘 일정</Text>
            {todaySchedules.length === 0 ? (
              <EmptyState message="오늘 일정이 없습니다." />
            ) : (
              todaySchedules.map((s) => <ScheduleItem key={s.id} schedule={s} />)
            )}

            {/* 내일 일정 */}
            <Text style={styles.sectionTitle}>📆 내일 일정</Text>
            {tomorrowSchedules.length === 0 ? (
              <EmptyState message="내일 일정이 없습니다." />
            ) : (
              tomorrowSchedules.map((s) => <ScheduleItem key={s.id} schedule={s} />)
            )}

            {/* CTA */}
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.ctaBtnText}>+ 오늘 일정 추가하기</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  listContent: { paddingBottom: 24, paddingTop: 8 },

  weatherCard: { marginTop: 8 },
  weatherRow: { flexDirection: 'row', alignItems: 'center' },
  weatherIcon: { fontSize: 36, marginRight: 12 },
  weatherInfo: {},
  weatherTemp: { fontSize: 24, fontWeight: '700', color: '#222' },
  weatherDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  weatherLoading: { fontSize: 14, color: '#999', textAlign: 'center' },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },

  ctaBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
