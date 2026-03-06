/**
 * Briefing 화면 – 섹션 카드 기반 UI
 *
 * 개선 사항:
 * 1. 긴 텍스트 덩어리 → AI요약 / 날씨 / 뉴스 / 주식 / 일정 카드로 섹션화
 * 2. FlatList + ListHeaderComponent → ScrollView 로 변경하여 하단 잘림 해결
 * 3. 공유하기 / 복사하기 버튼 추가 (RN Share + Clipboard)
 *
 * ?date=YYYY-MM-DD 쿼리 → 해당 날짜 다이제스트, 없으면 오늘
 */
import {
  BriefingAISummaryCard,
  BriefingNewsCard,
  BriefingScheduleCard,
  BriefingStockCard,
  BriefingWeatherCard,
} from '@/src/components/briefing';
import { Card } from '@/src/components/Card';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { GenerateDigestInput } from '@/src/features/digest';
import { isFallbackDigest, useDateDigest, useGenerateDigest } from '@/src/features/digest';
import { useSchedules } from '@/src/features/schedules';
import { useWeather } from '@/src/features/weather';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import type { DigestDoc } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── 공유용 텍스트 빌더 ──────────────────────────────────
function buildShareText(digest: DigestDoc, targetDate: string): string {
  const lines: string[] = [];
  lines.push(`📋 ${dayjs(targetDate).format('YYYY년 M월 D일')} 브리핑`);
  lines.push('');

  // AI 요약
  if (digest.aiBriefing) {
    lines.push(digest.aiBriefing);
    lines.push('');
  }

  // 날씨
  if (digest.weatherData) {
    const w = digest.weatherData;
    lines.push(`🌤 날씨 — ${w.city} ${w.temp}° (체감 ${w.feelsLike}°)`);
    lines.push(`  ${w.description}, 최저 ${w.tempMin}° / 최고 ${w.tempMax}°`);
    if (w.comment) lines.push(`  ${w.comment}`);
    lines.push('');
  }

  // 뉴스
  if (digest.newsData && digest.newsData.length > 0) {
    lines.push('📰 주요 뉴스');
    digest.newsData.slice(0, 5).forEach((n, i) => {
      lines.push(`  ${i + 1}. ${n.title}${n.source ? ` (${n.source})` : ''}`);
    });
    lines.push('');
  }

  // 주식
  if (digest.stockData && digest.stockData.length > 0) {
    lines.push('📈 주식');
    digest.stockData.forEach((s) => {
      lines.push(`  ${s.symbol} $${s.price} (${s.changePercent})`);
    });
    lines.push('');
  }

  // 구조화 데이터 없으면 기존 summary fallback
  if (!digest.aiBriefing && !digest.weatherData && !digest.newsData && !digest.stockData) {
    if (digest.summary) {
      lines.push(digest.summary);
      lines.push('');
    }
  }

  lines.push('— Push Office 모닝 브리핑');
  return lines.join('\n');
}

export default function BriefingScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const settings = useAppSelector((s) => s.settings);
  const storageMode = useAppSelector((s) => s.storageMode);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { colors } = useTheme();

  const targetDate = date || dayjs().format('YYYY-MM-DD');
  const isToday = targetDate === dayjs().format('YYYY-MM-DD');

  // ─── 데이터 훅 ─────────────────────────────────────────
  const { data: schedules, isLoading: schedulesLoading } = useSchedules();
  const {
    data: weather,
    isLoading: weatherLoading,
  } = useWeather();
  const {
    data: digest,
    isLoading: digestLoading,
    isError: digestError,
    refetch: refetchDigest,
  } = useDateDigest(targetDate);
  const generateMutation = useGenerateDigest();

  // ─── buildInput ─────────────────────────────────────────
  const buildInput = useCallback((): GenerateDigestInput => {
    const ownerId =
      storageMode.mode === 'local'
        ? storageMode.deviceKey ?? 'unknown'
        : uid ?? 'unknown';
    return {
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
  }, [uid, storageMode, settings, targetDate]);

  const handleGenerate = useCallback(() => {
    generateMutation.mutate({ input: buildInput() });
  }, [buildInput, generateMutation]);

  const handleRegenerate = useCallback(() => {
    generateMutation.mutate({ input: buildInput(), force: true });
  }, [buildInput, generateMutation]);

  // ─── 공유 / 복사 ───────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!digest) return;
    const text = buildShareText(digest, targetDate);
    try {
      await Share.share({
        message: text,
        ...(Platform.OS === 'ios' ? { title: '오늘의 브리핑' } : {}),
      });
    } catch {
      // 사용자가 공유 취소
    }
  }, [digest, targetDate]);

  const handleCopy = useCallback(async () => {
    if (!digest) return;
    const text = buildShareText(digest, targetDate);
    try {
      await Clipboard.setStringAsync(text);
      showToast('브리핑이 복사되었습니다');
    } catch {
      showToast('복사에 실패했습니다');
    }
  }, [digest, targetDate]);

  // ─── 일정 필터링 ──────────────────────────────────────
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

  // ─── 로딩 ─────────────────────────────────────────────
  if (schedulesLoading && digestLoading) return <Loading />;

  // ─── 구조화 데이터 추출 ────────────────────────────────
  const wd = digest?.weatherData;
  const nd = digest?.newsData;
  const sd = digest?.stockData;
  const aiBriefing = digest?.aiBriefing;

  // digest 구조화 데이터가 없을 때 클라이언트 날씨 데이터 fallback
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

  // 구조화 데이터가 하나도 없고, contentMarkdown만 있으면 레거시 모드
  const hasStructuredData = !!(aiBriefing || wd || nd?.length || sd?.length);
  const legacyMarkdown =
    !hasStructuredData && digest?.contentMarkdown ? digest.contentMarkdown : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 헤더 ───────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>데일리 다이제스트</Text>
            <Text style={[styles.headerDate, { color: colors.textSecondary }]}>
              {dayjs(targetDate).format('YYYY년 M월 D일 (ddd)')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.refreshBtn, { borderColor: colors.surfaceBorder }]}
            onPress={handleRegenerate}
            disabled={generateMutation.isPending}
            activeOpacity={0.6}
          >
            {generateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* 과거 날짜 배너 */}
        {!isToday && (
          <View style={[styles.pastBanner, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.pastBannerText, { color: colors.primary }]}>
              과거 브리핑을 보고 있습니다
            </Text>
          </View>
        )}

        {/* ─── 메인 콘텐츠 ─────────────────────────────── */}
        {digestLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              브리핑 불러오는 중...
            </Text>
          </View>
        ) : digestError ? (
          <Card>
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.textTertiary} />
              <Text style={[styles.errorText, { color: colors.textTertiary }]}>
                브리핑을 불러오지 못했습니다
              </Text>
              <TouchableOpacity
                style={[styles.actionBtnOutline, { borderColor: colors.primary }]}
                onPress={() => refetchDigest()}
              >
                <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>새로고침</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : digest ? (
          <>
            {/* fallback 배너 */}
            {isFallbackDigest(digest) && (
              <View style={[styles.fallbackBanner, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.primary} />
                <Text style={[styles.fallbackText, { color: colors.primary }]}>
                  이전 오류로 저장된 데이터입니다
                </Text>
                <TouchableOpacity
                  style={[styles.fallbackBtn, { borderColor: colors.primary }]}
                  onPress={handleRegenerate}
                  disabled={generateMutation.isPending}
                >
                  <Text style={[styles.fallbackBtnText, { color: colors.primary }]}>재생성</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 1. AI 한줄 요약 */}
            {aiBriefing ? <BriefingAISummaryCard text={aiBriefing} /> : null}

            {/* 2. 날씨 카드 */}
            {weatherLoading && !weatherProps ? (
              <Card>
                <ActivityIndicator size="small" color={colors.primary} />
              </Card>
            ) : weatherProps ? (
              <BriefingWeatherCard {...weatherProps} />
            ) : null}

            {/* 3. 뉴스 카드 */}
            {nd && nd.length > 0 ? <BriefingNewsCard items={nd} /> : null}

            {/* 4. 주식 카드 */}
            {sd && sd.length > 0 ? <BriefingStockCard items={sd} /> : null}

            {/* 5. 일정 카드 */}
            <BriefingScheduleCard
              todaySchedules={todaySchedules}
              tomorrowSchedules={tomorrowSchedules}
            />

            {/* 레거시 모드: 구조화 데이터 없으면 기존 markdown 표시 */}
            {legacyMarkdown ? (
              <Card>
                <Text style={[styles.legacySectionTitle, { color: colors.textSecondary }]}>
                  브리핑 내용
                </Text>
                <Text style={[styles.legacyText, { color: colors.text }]}>
                  {legacyMarkdown}
                </Text>
                {digest.sources && digest.sources.length > 0 && (
                  <Text style={[styles.sourcesText, { color: colors.textTertiary }]}>
                    출처: {digest.sources.map((s) => (typeof s === 'string' ? s : s.label)).join(', ')}
                  </Text>
                )}
              </Card>
            ) : null}

            {/* ─── 하단 액션 바 ──────────────────────── */}
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>공유하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder }]}
                onPress={handleCopy}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>복사하기</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* digest 없을 때 – 생성 CTA */
          <Card>
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={36} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                {dayjs(targetDate).format('M월 D일')} 브리핑이 아직 없습니다
              </Text>
              {generateMutation.isError && (
                <Text style={[styles.errorSmall, { color: colors.danger }]}>
                  생성에 실패했습니다. 다시 시도해 주세요.
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  { backgroundColor: colors.primary },
                  generateMutation.isPending && { opacity: 0.6 },
                ]}
                onPress={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.generateBtnText}>
                    {generateMutation.isError ? '다시 생성' : '브리핑 생성하기'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* 일정이 있지만 구조화 카드에 포함되지 않았을 때 (레거시) */}
        {legacyMarkdown && (todaySchedules.length > 0 || tomorrowSchedules.length > 0) && (
          <View style={styles.legacySchedules}>
            {todaySchedules.length > 0 && (
              <>
                <Text style={[styles.scheduleSectionTitle, { color: colors.textSecondary }]}>
                  {isToday ? '오늘 일정' : `${dayjs(targetDate).format('M/D')} 일정`}
                </Text>
                {todaySchedules.map((s) => (
                  <ScheduleItem key={s.id} schedule={s} />
                ))}
              </>
            )}
            {tomorrowSchedules.length > 0 && (
              <>
                <Text style={[styles.scheduleSectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>
                  {isToday ? '내일 일정' : `${dayjs(targetDate).add(1, 'day').format('M/D')} 일정`}
                </Text>
                {tomorrowSchedules.map((s) => (
                  <ScheduleItem key={s.id} schedule={s} />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 스타일 ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  /**
   * 핵심: paddingBottom 을 충분히 줘서 하단 탭 + safe area 에 가려지지 않음
   * 기존 FlatList + ListHeaderComponent 구조에서는 이 값이 부족했음
   */
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },

  /* 헤더 */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerDate: { fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  /* 과거 날짜 배너 */
  pastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  pastBannerText: { fontSize: 13, fontWeight: '500' },

  /* 로딩 / 에러 */
  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  loadingText: { fontSize: 14 },
  errorBox: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  errorText: { fontSize: 14 },
  actionBtnOutline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '600' },

  /* fallback 배너 */
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  fallbackText: { flex: 1, fontSize: 12 },
  fallbackBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fallbackBtnText: { fontSize: 12, fontWeight: '600' },

  /* 레거시 markdown */
  legacySectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  legacyText: { fontSize: 14, lineHeight: 22 },
  sourcesText: { fontSize: 11, marginTop: 8 },

  /* 하단 액션 바 */
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  /* 빈 상태 */
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyTitle: { fontSize: 14 },
  errorSmall: { fontSize: 12 },
  generateBtn: {
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 4,
  },
  generateBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  /* 레거시 일정 섹션 */
  legacySchedules: { marginTop: 16 },
  scheduleSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 6,
  },
});
