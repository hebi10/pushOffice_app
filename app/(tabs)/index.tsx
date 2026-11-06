import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { Ionicons } from '@expo/vector-icons';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { BriefingNewsCard, BriefingStockCard, BriefingWeatherCard } from '@/src/components/briefing';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useGenerateDigest } from '@/src/features/digest';
import { useSchedules } from '@/src/features/schedules';
import { hydrateSchedule, nextSchedule, projectOccurrences, toNativeSchedule } from '@/src/features/schedules/scheduleCodec';
import { useClock } from '@/src/features/notifications/useNativeAssistant';
import { dayjs } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import { PushOfficeNative } from '@/modules/push-office-native';
import { showError } from '@/src/components/ui/toast';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ForegroundRequest, runForegroundRequest } from '@/src/features/notifications/foregroundRequest';
import { AppState, RefreshControl, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
export default function HomeScreen() {
    const { colors } = useTheme();
    const now = useClock();
    const settings = useAppSelector(x => x.settings);
    const uid = useAppSelector(x => x.auth.uid);
    const schedules = useSchedules();
    const external = useGenerateDigest();
    const [ai, setAi] = useState({ status: 'unavailable', message: '기기 지원 상태를 확인하고 있습니다.' });
    const [refined, setRefined] = useState('');
    const [busy, setBusy] = useState(false);
    const request = useRef(new ForegroundRequest()).current;
    useFocusEffect(useCallback(() => {
        let statusRevision = 0;
        const refresh = () => {
            request.setActive(AppState.currentState === 'active');
            setRefined(''); setBusy(false);
            const revision = ++statusRevision;
            if (AppState.currentState !== 'active') return;
            PushOfficeNative.getAiStatus().then(value => { if (revision === statusRevision) setAi(value); })
                .catch(() => { if (revision === statusRevision) setAi({ status: 'unavailable', message: '이 Android 빌드에서는 로컬 AI를 사용할 수 없습니다.' }); });
        };
        refresh();
        const sub = AppState.addEventListener('change', refresh);
        return () => { statusRevision++; request.setActive(false); sub.remove(); };
    }, [request]));
    const occurrences = useMemo(() => {
        const date = new Date(now);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return projectOccurrences((schedules.data ?? []).map(toNativeSchedule), start, end).map(hydrateSchedule);
    }, [schedules.data, now]);
    const today = dayjs(now).format('YYYY-MM-DD');
    const todayItems = occurrences.filter(x => dayjs(x.startAt.toDate()).format('YYYY-MM-DD') === today);
    const next = useMemo(() => {
        const record = nextSchedule((schedules.data ?? []).map(toNativeSchedule), now);
        return record ? hydrateSchedule(record) : null;
    }, [schedules.data, now]);
    const summary = schedules.isLoading ? '기기에 저장된 일정을 확인하고 있어요.' : todayItems.length ? `오늘은 ${todayItems.length}개의 일정이 있어요. ${todayItems.map(x => `${x.isAllDay ? '하루 종일' : dayjs(x.startAt.toDate()).format('HH:mm')} ${x.title}`).join(', ')}.${next ? ` 다음 일정은 ${dayjs(next.startAt.toDate()).format('M월 D일 HH:mm')} ${next.title}입니다.` : ''}` : '오늘 등록된 일정은 없어요. 여유 있는 하루를 계획해 보세요.';
    const source = JSON.stringify([today, summary, schedules.data]);
    // Ref revision changes immediately with source render, before any deferred native completion.
    request.setSource(source);
    useLayoutEffect(() => { setRefined(''); setBusy(false); }, [source]);
    const open = () => PushOfficeNative.openQuickEntry().catch(e => showError(e, '빠른 입력을 열 수 없습니다.'));
    const refine = async () => {
        const valid = request.begin();
        setBusy(true);
        await runForegroundRequest(valid,
            () => PushOfficeNative.generateBriefing(`한국어로 짧고 친절한 일정 브리핑을 작성하세요. 없는 사실을 추가하지 마세요. ${summary}`),
            { result: setRefined, error: e => showError(e, '로컬 AI 요약을 만들 수 없습니다.'), finish: () => {
                setBusy(false);
                PushOfficeNative.getAiStatus().then(value => { if (valid()) setAi(value); }).catch(() => {});
            } });
    };
    const nextAt = next?.startAt?.toDate?.();
    const nextEndAt = next?.endAt?.toDate?.();
    const nextEndIsValid = Boolean(nextAt && nextEndAt && nextEndAt.getTime() > nextAt.getTime());
    const nextEndSameDay = Boolean(nextAt && nextEndAt && dayjs(nextAt).isSame(dayjs(nextEndAt), 'day'));
    const nextEndLabel = nextEndIsValid && nextEndAt && !next?.isAllDay
        ? nextEndSameDay ? `~ ${dayjs(nextEndAt).format('HH:mm')}` : `~ ${dayjs(nextEndAt).format('M/D HH:mm')}`
        : '';
    const todayHeadline = schedules.isError
        ? '일정을 불러오지 못했습니다.'
        : schedules.isLoading
            ? '기기에 저장된 일정을 확인하는 중입니다.'
            : todayItems.length
                ? '오늘의 일정을 한눈에 확인하세요.'
                : '오늘은 예정된 일정이 없습니다.';
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={schedules.isRefetching} onRefresh={() => { void schedules.refetch(); }} />}
      >
        <ScreenIntro
          eyebrow="로컬 일정 비서"
          title={new Date(now).getHours() < 12 ? '좋은 아침이에요' : '오늘도 차근차근'}
          description={dayjs(now).format('M월 D일 dddd')}
          artwork={require('@/assets/images/illustration-home.jpg')}
        />

        <View style={styles.quickEntry}>
          <AssistantButton
            label="일정 빠르게 추가"
            icon="add-circle-outline"
            onPress={open}
          />
          <Text style={[styles.quickEntryHint, { color: colors.textSecondary }]}>
            텍스트 또는 음성으로 새 일정을 기록하세요.
          </Text>
        </View>

        <AssistantCard title="오늘의 브리핑" icon="sunny-outline" compact>
          <View style={styles.briefingHeading}>
            <View style={styles.briefingCopy}>
              <Text style={[styles.briefingHeadline, { color: colors.text }]}>
                {refined || todayHeadline}
              </Text>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {refined ? 'Gemini Nano가 기기에서 정리한 브리핑' : '기기에 저장된 일정만으로 만든 요약'}
              </Text>
            </View>
            {!schedules.isLoading && !schedules.isError ? (
              <View style={[styles.countPill, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>
                  {todayItems.length}건
                </Text>
              </View>
            ) : null}
          </View>
          {ai.status === 'available' ? (
            <AssistantButton
              label="기기 AI로 브리핑 다듬기"
              icon="sparkles-outline"
              secondary
              busy={busy}
              onPress={refine}
            />
          ) : null}
        </AssistantCard>

        <AssistantCard title="다음 일정" icon="calendar-outline" compact>
          {schedules.isLoading ? (
            <Text style={[s.body, { color: colors.textSecondary }]}>다음 일정을 확인하는 중입니다.</Text>
          ) : schedules.isError ? (
            <Text style={[s.body, { color: colors.danger }]}>일정 조회 오류로 다음 일정을 표시할 수 없습니다.</Text>
          ) : next && nextAt ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${next.title}, ${dayjs(nextAt).format('M월 D일')}, ${next.isAllDay ? '종일' : dayjs(nextAt).format('HH:mm')}${nextEndLabel ? ` ${nextEndLabel}` : ''}, 일정 상세 보기`}
              accessibilityState={{ disabled: !next.id }}
              disabled={!next.id}
              onPress={() => { if (next.id) router.push(`/schedule/${next.id}`); }}
              activeOpacity={0.75}
              style={[styles.nextCard, { backgroundColor: colors.primaryLight, borderColor: colors.surfaceBorder }]}
            >
              <View style={[styles.nextAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.nextTimeCol}>
                <Text style={[styles.nextTime, { color: colors.primary }]}>
                  {next.isAllDay ? '종일' : dayjs(nextAt).format('HH:mm')}
                </Text>
                {nextEndLabel && nextEndSameDay ? (
                  <Text style={[styles.nextEnd, { color: colors.textSecondary }]}>{nextEndLabel}</Text>
                ) : null}
              </View>
              <View style={styles.nextContent}>
                <Text style={[styles.nextTitle, { color: colors.text }]} numberOfLines={2}>{next.title}</Text>
                <Text style={[styles.nextDate, { color: colors.textSecondary }]}>
                  {dayjs(nextAt).format('M월 D일 (ddd)')}
                  {nextEndLabel && !nextEndSameDay ? ` · ${nextEndLabel}` : ''}
                  {next.repeatType === 'monthly' ? ' · 매월 반복' : next.repeatType === 'yearly' ? ' · 매년 반복' : ''}
                </Text>
              </View>
              {next.id ? <Ionicons name="chevron-forward" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
          ) : (
            <Text style={[s.body, { color: colors.textSecondary }]}>다가오는 일정이 없습니다. 빠른 입력으로 등록해 보세요.</Text>
          )}
        </AssistantCard>

        <AssistantCard title="오늘 일정" icon="list-outline" compact>
          <View style={styles.agendaHeading}>
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              {schedules.isLoading ? '일정을 확인하고 있습니다.' : `오늘 등록된 일정 ${todayItems.length}건`}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="캘린더에서 일정 전체 보기"
              onPress={() => router.push('/(tabs)/calendar')}
              style={styles.calendarLink}
            >
              <Text style={[styles.calendarLinkText, { color: colors.primary }]}>캘린더</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {schedules.isError ? (
            <Text style={[s.body, { color: colors.danger }]}>
              일정을 불러오지 못했습니다. 아래로 당겨 다시 확인해 주세요.
            </Text>
          ) : schedules.isLoading ? (
            <Text style={[s.body, { color: colors.textSecondary }]}>일정 목록을 불러오는 중입니다.</Text>
          ) : todayItems.length ? (
            <View style={styles.agendaList}>
              {todayItems.map((item, index) => (
                <ScheduleItem
                  key={`${item.id ?? index}-${item.startAt.toMillis()}`}
                  schedule={item}
                />
              ))}
            </View>
          ) : (
            <Text style={[s.body, { color: colors.textSecondary }]}>
              아직 일정이 없습니다. “내일 오전 9시 회의”처럼 입력해 보세요.
            </Text>
          )}
        </AssistantCard>

        <View style={styles.externalSection}>
          <Text style={[styles.externalLabel, { color: colors.textSecondary }]}>
            선택한 외부 정보
          </Text>
          <AssistantCard title="외부 브리핑" icon="cloud-outline">
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              날씨·뉴스·주식은 요청할 때만 가져옵니다. 일정 내용은 외부로 전송하지 않습니다.
            </Text>
            <AssistantButton
              label="외부 브리핑 불러오기"
              icon="cloud-download-outline"
              secondary
              busy={external.isPending}
              onPress={() => external.mutate({ input: {
                ownerId: uid ?? 'local', ownerType: 'device', dateKey: today,
                timezone: settings.timezone, types: settings.digestTypes,
                city: settings.digestCity, stockTickers: settings.stockTickers,
                newsKeywords: settings.newsKeywords, newsLanguage: settings.newsLanguage,
                allowExternal: true,
              }, force: true })}
            />
            {external.isError ? (
              <Text style={[s.caption, { color: colors.danger }]}>
                외부 정보를 가져오지 못했습니다. 로컬 일정은 계속 사용할 수 있습니다.
              </Text>
            ) : null}
          </AssistantCard>
          {external.data?.weatherData ? <BriefingWeatherCard {...external.data.weatherData} /> : null}
          {external.data?.newsData ? <BriefingNewsCard items={external.data.newsData} /> : null}
          {external.data?.stockData ? <BriefingStockCard items={external.data.stockData} /> : null}
        </View>
      </ScrollView>
    );

}


const styles = StyleSheet.create({
  quickEntry: { gap: uiSpacing.xs },
  quickEntryHint: {
    ...uiTypography.caption,
    paddingHorizontal: uiSpacing.xxs,
  },
  briefingHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.sm,
  },
  briefingCopy: { flex: 1, gap: uiSpacing.xxs },
  briefingHeadline: { ...uiTypography.body, fontWeight: '600' },
  countPill: {
    minHeight: 30,
    minWidth: 42,
    borderRadius: uiRadii.button,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { ...uiTypography.caption, fontWeight: '700' },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.xs,
    gap: uiSpacing.sm,
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.field,
  },
  nextAccent: { width: 3, alignSelf: 'stretch' },
  nextTimeCol: { width: 62, gap: uiSpacing.xxs },
  nextTime: { ...uiTypography.body, fontSize: 18, fontWeight: '800' },
  nextEnd: { ...uiTypography.caption },
  nextContent: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  nextTitle: { ...uiTypography.body, fontWeight: '700' },
  nextDate: { ...uiTypography.caption },
  agendaHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: uiSpacing.sm },
  calendarLink: { minHeight: uiSizes.touchMinHeight, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: uiSpacing.xs, justifyContent: 'center' },
  calendarLinkText: { ...uiTypography.caption, fontWeight: '700' },
  agendaList: { gap: uiSpacing.xs },
  externalSection: { gap: uiSpacing.sm, paddingTop: uiSpacing.xs },
  externalLabel: { ...uiTypography.caption, fontWeight: '700', paddingHorizontal: uiSpacing.xxs },
});
