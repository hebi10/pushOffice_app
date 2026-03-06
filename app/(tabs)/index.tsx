/**
 * Home 화면 – 출근 전 30초 모닝 브리핑
 *
 * AI 요약 → 날씨 → 뉴스 → 주식 → 오늘/내일 일정 카드 표시
 * - 진입 시 자동 생성 (당일 digest 없으면)
 * - pull-to-refresh 재생성
 */
import {
  BriefingAISummaryCard,
  BriefingNewsCard,
  BriefingScheduleCard,
  BriefingStockCard,
  BriefingWeatherCard,
} from '@/src/components/briefing';
import { Loading } from '@/src/components/Loading';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { GenerateDigestInput } from '@/src/features/digest';
import { isFallbackDigest, useDateDigest, useGenerateDigest } from '@/src/features/digest';
import {
  requestNotificationPermission,
  rescheduleOverdueRepeating,
} from '@/src/features/notifications';
import { useSchedules } from '@/src/features/schedules';
import { useWeather } from '@/src/features/weather';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import type { ScheduleDoc } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const settings = useAppSelector((s) => s.settings);
  const storageMode = useAppSelector((s) => s.storageMode);
  const { colors } = useTheme();

  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // ─── 데이터 훅 ─────────────────────────────────────────
  const { data: schedules, isLoading: schedulesLoading } = useSchedules();
  const { data: weather, isLoading: weatherLoading } = useWeather();
  const {
    data: digest,
    isLoading: digestLoading,
    refetch: refetchDigest,
  } = useDateDigest(today);
  const generateMutation = useGenerateDigest();

  // ─── 앱 진입 시 반복 일정 재스케줄 ──────────────────────
  useEffect(() => {
    if (uid) {
      rescheduleOverdueRepeating(uid).catch(console.error);
      requestNotificationPermission().catch(console.error);
    }
  }, [uid]);

  // ─── buildInput 헬퍼 ────────────────────────────────────
  const buildInput = useCallback((): GenerateDigestInput => {
    const ownerId =
      storageMode.mode === 'local'
        ? storageMode.deviceKey ?? 'unknown'
        : uid ?? 'unknown';
    return {
      ownerType: storageMode.mode === 'local' ? 'device' : 'user',
      ownerId,
      dateKey: today,
      timezone: settings.timezone,
      types: settings.digestTypes ?? { weather: true, stocks: false, news: true },
      city: settings.digestCity,
      stockTickers: settings.stockTickers,
      newsKeywords: settings.newsKeywords,
      newsLanguage: settings.newsLanguage,
    };
  }, [uid, storageMode, settings, today]);

  // ─── 자동 생성 (당일 digest 없거나 fallback이면) ────────
  const autoTriggered = useRef(false);
  useEffect(() => {
    if (autoTriggered.current) return;
    if (digestLoading) return;
    if (!digest || isFallbackDigest(digest)) {
      autoTriggered.current = true;
      generateMutation.mutate({ input: buildInput() });
    }
  }, [digest, digestLoading, buildInput, generateMutation]);

  // ─── pull-to-refresh ───────────────────────────────────
  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await generateMutation.mutateAsync({ input: buildInput(), force: true });
      await refetchDigest();
    } catch {
      // swallow
    }
    setRefreshing(false);
  }, [buildInput, generateMutation, refetchDigest]);

  // ─── 일정 필터링 ──────────────────────────────────────
  const todayStart = dayjs(today).startOf('day');
  const todayEnd = dayjs(today).endOf('day');
  const tomorrowStart = dayjs(tomorrow).startOf('day');
  const tomorrowEnd = dayjs(tomorrow).endOf('day');

  const todaySchedules = useMemo<ScheduleDoc[]>(
    () =>
      (schedules ?? []).filter((s) => {
        const d = dayjs(s.startAt?.toDate?.());
        return d.isAfter(todayStart) && d.isBefore(todayEnd);
      }),
    [schedules, todayStart, todayEnd],
  );

  const tomorrowSchedules = useMemo<ScheduleDoc[]>(
    () =>
      (schedules ?? []).filter((s) => {
        const d = dayjs(s.startAt?.toDate?.());
        return d.isAfter(tomorrowStart) && d.isBefore(tomorrowEnd);
      }),
    [schedules, tomorrowStart, tomorrowEnd],
  );

  // ─── 로딩 상태 ────────────────────────────────────────
  const isInitialLoading = schedulesLoading && digestLoading;
  if (isInitialLoading) return <Loading />;

  // ─── digest 에서 구조화 데이터 추출 ──────────────────────
  const wd = digest?.weatherData;
  const nd = digest?.newsData;
  const sd = digest?.stockData;
  const aiBriefing = digest?.aiBriefing;

  // 날씨: digest에 포함된 구조화 데이터 우선, 없으면 클라이언트 직접 호출
  const weatherProps = wd
    ? wd
    : weather
      ? {
          temp: weather.temp,
          feelsLike: weather.feelsLike ?? weather.temp,
          tempMin: weather.tempMin ?? weather.temp,
          tempMax: weather.tempMax ?? weather.temp,
          description: weather.description,
          city: weather.city,
          comment: weather.comment,
        }
      : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
            {dayjs().format('M월 D일 dddd')}
          </Text>
        </View>

        {/* 생성 중 인디케이터 */}
        {generateMutation.isPending && (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.generatingText, { color: colors.textSecondary }]}>
              브리핑 생성 중...
            </Text>
          </View>
        )}

        {/* 1. AI 요약 */}
        {aiBriefing ? <BriefingAISummaryCard text={aiBriefing} /> : null}

        {/* 2. 날씨 */}
        {weatherLoading && !weatherProps ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : weatherProps ? (
          <BriefingWeatherCard {...weatherProps} />
        ) : null}

        {/* 3. 뉴스 */}
        {nd && nd.length > 0 ? <BriefingNewsCard items={nd} /> : null}

        {/* 4. 주식 */}
        {sd && sd.length > 0 ? <BriefingStockCard items={sd} /> : null}

        {/* 5. 일정 */}
        <BriefingScheduleCard
          todaySchedules={todaySchedules}
          tomorrowSchedules={tomorrowSchedules}
        />

        {/* digest 없고 생성 실패 시 수동 트리거 */}
        {!digest && !generateMutation.isPending && (
          <TouchableOpacity
            style={[styles.manualBtn, { backgroundColor: colors.primary }]}
            onPress={() => generateMutation.mutate({ input: buildInput() })}
          >
            <Ionicons name="sparkles-outline" size={16} color="#FFF" />
            <Text style={styles.manualBtnText}>
              {generateMutation.isError ? '다시 생성하기' : '브리핑 생성하기'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** 시간대별 인사말 */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '새벽이네요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 24 },

  header: { paddingHorizontal: 20, marginBottom: 12 },
  greeting: { fontSize: 22, fontWeight: '700' },
  dateLabel: { fontSize: 14, marginTop: 2 },

  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  generatingText: { fontSize: 13 },

  loadingCard: { alignItems: 'center', paddingVertical: 20 },

  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
  },
  manualBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
