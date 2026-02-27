/**
 * Briefing 화면 – 날씨 + 오늘/내일 일정 + 데일리 다이제스트
 *
 * ?date=YYYY-MM-DD 쿼리가 있으면 해당 날짜의 다이제스트를 표시,
 * 없으면 오늘 날짜를 기준으로 한다.
 */
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import type { GenerateDigestInput } from '@/src/features/digest';
import { useDateDigest, useGenerateDigest } from '@/src/features/digest';
import { useSchedules } from '@/src/features/schedules';
import { useWeather } from '@/src/features/weather';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BriefingScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const settings = useAppSelector((s) => s.settings);
  const storageMode = useAppSelector((s) => s.storageMode);
  const { date } = useLocalSearchParams<{ date?: string }>();

  const targetDate = date || dayjs().format('YYYY-MM-DD');
  const isToday = targetDate === dayjs().format('YYYY-MM-DD');

  const { data: schedules, isLoading: schedulesLoading } = useSchedules();
  const { data: weather, isLoading: weatherLoading } = useWeather();
  const { data: digest, isLoading: digestLoading } = useDateDigest(targetDate);
  const generateMutation = useGenerateDigest();

  const handleGenerate = useCallback(() => {
    const ownerId =
      storageMode.mode === 'local'
        ? storageMode.deviceKey ?? 'unknown'
        : uid ?? 'unknown';
    const input: GenerateDigestInput = {
      ownerType: storageMode.mode === 'local' ? 'device' : 'user',
      ownerId,
      dateKey: targetDate,
      timezone: settings.timezone,
      types: settings.digestTypes ?? { weather: true, stocks: false, news: true },
      city: settings.digestCity,
      stockTickers: settings.stockTickers,
      newsKeywords: settings.newsKeywords,
      newsLanguage: settings.newsLanguage,
    };
    generateMutation.mutate(input);
  }, [uid, storageMode, settings, targetDate, generateMutation]);

  const todayStart = dayjs(targetDate).startOf('day');
  const todayEnd = dayjs(targetDate).endOf('day');
  const tomorrowStart = dayjs(targetDate).add(1, 'day').startOf('day');
  const tomorrowEnd = dayjs(targetDate).add(1, 'day').endOf('day');

  const todaySchedules = useMemo(
    () =>
      (schedules ?? []).filter((s) => {
        const d = dayjs(s.startAt?.toDate?.());
        return d.isAfter(todayStart) && d.isBefore(todayEnd);
      }),
    [schedules, todayStart, todayEnd],
  );

  const tomorrowSchedules = useMemo(
    () =>
      (schedules ?? []).filter((s) => {
        const d = dayjs(s.startAt?.toDate?.());
        return d.isAfter(tomorrowStart) && d.isBefore(tomorrowEnd);
      }),
    [schedules, tomorrowStart, tomorrowEnd],
  );

  if (schedulesLoading) return <Loading />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            {/* 날짜 표시 (과거 조회 시) */}
            {!isToday && (
              <View style={styles.pastDateBanner}>
                <Text style={styles.pastDateText}>
                  {dayjs(targetDate).format('YYYY년 M월 D일 (ddd)')} 브리핑
                </Text>
              </View>
            )}

            {/* 데일리 다이제스트 */}
            <Card style={styles.digestCard}>
              <Text style={styles.digestSectionTitle}>데일리 다이제스트</Text>

              {digestLoading ? (
                <ActivityIndicator size="small" color="#4A90D9" />
              ) : digest ? (
                <View>
                  <Text style={styles.digestTitle}>{digest.title}</Text>
                  <Text style={styles.digestSummary}>{digest.summary}</Text>

                  {digest.contentMarkdown ? (
                    <ScrollView
                      style={styles.digestMarkdown}
                      nestedScrollEnabled
                    >
                      <Text style={styles.digestMarkdownText}>
                        {digest.contentMarkdown}
                      </Text>
                    </ScrollView>
                  ) : null}

                  {digest.sources && digest.sources.length > 0 && (
                    <View style={styles.sourcesRow}>
                      <Text style={styles.sourcesLabel}>
                        출처: {digest.sources.join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noDigest}>
                  <Text style={styles.noDigestText}>
                    {targetDate} 다이제스트가 아직 없습니다.
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.generateBtn,
                      generateMutation.isPending && styles.generateBtnDisabled,
                    ]}
                    disabled={generateMutation.isPending}
                    onPress={handleGenerate}
                  >
                    {generateMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.generateBtnText}>
                        다이제스트 생성
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Card>

            {/* 날씨 (오늘만 표시) */}
            {isToday && (
              <Card style={styles.weatherCard}>
                {weatherLoading ? (
                  <Text style={styles.weatherLoading}>날씨 불러오는 중...</Text>
                ) : weather ? (
                  <View style={styles.weatherRow}>
                    <View style={styles.weatherInfo}>
                      <Text style={styles.weatherTemp}>{weather.temp} C</Text>
                      <Text style={styles.weatherDesc}>
                        {weather.city} / {weather.description}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.weatherLoading}>
                    날씨 정보를 불러올 수 없습니다.
                  </Text>
                )}
              </Card>
            )}

            {/* 당일 일정 */}
            <Text style={styles.sectionTitle}>
              {isToday ? '오늘 일정' : `${dayjs(targetDate).format('M/D')} 일정`}
            </Text>
            {todaySchedules.length === 0 ? (
              <EmptyState message="해당 날짜의 일정이 없습니다." />
            ) : (
              todaySchedules.map((s) => (
                <ScheduleItem key={s.id} schedule={s} />
              ))
            )}

            {/* 내일 일정 */}
            <Text style={styles.sectionTitle}>
              {isToday
                ? '내일 일정'
                : `${dayjs(targetDate).add(1, 'day').format('M/D')} 일정`}
            </Text>
            {tomorrowSchedules.length === 0 ? (
              <EmptyState message="해당 날짜의 일정이 없습니다." />
            ) : (
              tomorrowSchedules.map((s) => (
                <ScheduleItem key={s.id} schedule={s} />
              ))
            )}

            {/* CTA */}
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.ctaBtnText}>+ 일정 추가하기</Text>
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

  pastDateBanner: {
    backgroundColor: '#E8F0FE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  pastDateText: { fontSize: 14, fontWeight: '600', color: '#1A73E8' },

  /* digest */
  digestCard: { marginTop: 8 },
  digestSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },
  digestTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  digestSummary: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  digestMarkdown: {
    maxHeight: 260,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  digestMarkdownText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  sourcesRow: { marginTop: 4 },
  sourcesLabel: { fontSize: 11, color: '#AAA' },

  noDigest: { alignItems: 'center', paddingVertical: 12 },
  noDigestText: { fontSize: 13, color: '#999', marginBottom: 10 },
  generateBtn: {
    backgroundColor: '#27AE60',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  /* weather */
  weatherCard: { marginTop: 8 },
  weatherRow: { flexDirection: 'row', alignItems: 'center' },
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
