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
import { PushOfficeNative, type NotificationSuggestion, type NotificationSuggestionStatus } from '@/modules/push-office-native';
import { AppDialog } from '@/src/components/ui/AppDialog';
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
    const [notificationSuggestions, setNotificationSuggestions] = useState<NotificationSuggestion[]>([]);
    const [notificationFeature, setNotificationFeature] = useState<NotificationSuggestionStatus | null>(null);
    const [showNotificationDisclosure, setShowNotificationDisclosure] = useState(false);
    const refreshSuggestions = useCallback(() => {
      void PushOfficeNative.getNotificationSuggestions().then(setNotificationSuggestions).catch(() => setNotificationSuggestions([]));
      void PushOfficeNative.getNotificationSuggestionStatus().then(setNotificationFeature).catch(() => setNotificationFeature(null));
    }, []);
    const declineSuggestion = async (id: string) => {
      try { await PushOfficeNative.dismissNotificationSuggestion(id); refreshSuggestions(); }
      catch (error) { showError(error, '일정 후보를 거절하지 못했습니다.'); }
    };
    const reviewSuggestion = async (id: string) => {
      try { await PushOfficeNative.openNotificationSuggestion(id); }
      catch (error) { showError(error, '일정 후보를 열지 못했습니다.'); refreshSuggestions(); }
    };
    const [refined, setRefined] = useState('');
    const [busy, setBusy] = useState(false);
    const request = useRef(new ForegroundRequest()).current;
    useFocusEffect(useCallback(() => {
        let statusRevision = 0;
        const refresh = () => {
            request.setActive(AppState.currentState === 'active');
            if (AppState.currentState === 'active') refreshSuggestions();
            setRefined(''); setBusy(false);
            const revision = ++statusRevision;
            if (AppState.currentState !== 'active') return;
            PushOfficeNative.getAiStatus().then(value => { if (revision === statusRevision) setAi(value); })
                .catch(() => { if (revision === statusRevision) setAi({ status: 'unavailable', message: '이 Android 빌드에서는 로컬 AI를 사용할 수 없습니다.' }); });
        };
        refresh();
        const sub = AppState.addEventListener('change', refresh);
        return () => { statusRevision++; request.setActive(false); sub.remove(); };
    }, [request, refreshSuggestions]));
    const occurrences = useMemo(() => {
        const date = new Date(now);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return projectOccurrences((schedules.data ?? []).map(toNativeSchedule), start, end).map(hydrateSchedule);
    }, [schedules.data, now]);
    const today = dayjs(now).format('YYYY-MM-DD');
    const todayItems = occurrences.filter(x => dayjs(x.startAt.toDate()).format('YYYY-MM-DD') === today)
        .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
    const firstToday = todayItems[0];
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
    const openVoice = () => PushOfficeNative.openVoiceQuickEntry().catch(e => showError(e, '음성 입력을 열 수 없습니다.'));
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
                ? `첫 일정 ${firstToday.isAllDay ? '종일' : dayjs(firstToday.startAt.toDate()).format('HH:mm')} · ${firstToday.title}`
                : '오늘은 예정된 일정이 없어요.';
    return (
      <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={schedules.isRefetching} onRefresh={() => { void schedules.refetch(); }} />}
      >
        <ScreenIntro
          eyebrow={dayjs(now).format('M월 D일 dddd')}
          title={new Date(now).getHours() < 12 ? '좋은 아침이에요' : '오늘도 차근차근'}
          description="중요한 일정부터 하나씩 살펴보세요."
          graphicIcon="calendar-outline"
          featured
        />

        <View style={styles.quickEntry}>
          <AssistantButton
            label="일정 빠르게 추가"
            icon="add-circle-outline"
            onPress={open}
          />
          <View style={styles.quickEntryTools}>
            <Text style={[styles.quickEntryHint, { color: colors.textSecondary }]}>
              텍스트·음성 중 입력 방식 선택
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="음성 입력 바로 열기"
              accessibilityHint="녹음은 음성 입력 시작을 누를 때만 실행됩니다."
              onPress={openVoice}
              style={styles.voiceAction}
            >
              <Ionicons name="mic-outline" size={17} color={colors.primary} />
              <Text style={[styles.voiceActionText, { color: colors.primary }]}>음성 입력</Text>
            </TouchableOpacity>
          </View>
        </View>

        {notificationFeature && !notificationFeature.enabled ? (
          <AssistantCard title="알림에서 일정 추천" icon="notifications-outline" compact>
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              사용자가 허용한 경우에만 다른 앱의 알림에서 일정 후보를 제안합니다. 권한을 허용하면 민감한 알림 내용에도 접근할 수 있으며, 저장 전 반드시 확인합니다.
            </Text>
            <AssistantButton
              label="알림 분석 안내 및 이용 설정"
              icon="shield-checkmark-outline"
              secondary
              onPress={() => setShowNotificationDisclosure(true)}
            />
          </AssistantCard>
        ) : null}

        {notificationSuggestions.length > 0 ? (
          <AssistantCard title="확인할 일정 추천" icon="calendar-outline" subtitle="다른 앱 알림에서 분석한 일정입니다. 확인한 후에만 저장됩니다." compact>
            {notificationSuggestions.slice(0, 3).map(item => (
              <View key={item.id} style={{ borderWidth: uiSizes.borderWidth, borderColor: colors.inputBorder, padding: uiSpacing.sm, gap: uiSpacing.xs }}>
                <Text style={[s.body, { color: colors.text, fontWeight: '700' }]}>{item.title}</Text>
                <Text style={[s.caption, { color: colors.textSecondary }]}>
                  {dayjs(item.startAt).format('M월 D일 (ddd) HH:mm')} · {item.sourceApp}
                </Text>
                <Text numberOfLines={2} style={[s.caption, { color: colors.textSecondary }]}>{item.excerpt}</Text>
                <View style={{ gap: uiSpacing.xs }}>
                  <AssistantButton label="확인 후 일정 추가" icon="checkmark-outline" onPress={() => { void reviewSuggestion(item.id); }} />
                  <AssistantButton label="거절" icon="close-outline" secondary onPress={() => { void declineSuggestion(item.id); }} />
                </View>
              </View>
            ))}
            {notificationSuggestions.length > 3 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`일정 추천 ${notificationSuggestions.length}건 모두 확인`}
                onPress={() => router.push('/(tabs)/settings')}
                style={{ minHeight: uiSizes.touchMinHeight, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={[s.caption, { color: colors.primary }]}>나머지 {notificationSuggestions.length - 3}건 설정에서 확인</Text>
              </TouchableOpacity>
            ) : null}
          </AssistantCard>
        ) : null}

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
            {!schedules.isLoading && !schedules.isError && todayItems.length > 0 ? (
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
            <Text style={[s.body, { color: colors.textSecondary }]}>다가오는 일정이 없습니다.</Text>
          )}
        </AssistantCard>

        {(schedules.isLoading || schedules.isError || todayItems.length > 0) ? (
          <AssistantCard title="오늘 일정" icon="list-outline" compact>
          <View style={styles.agendaHeading}>
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              {schedules.isLoading ? '일정을 확인하고 있습니다.' : '시간순 일정 목록'}
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
        ) : null}

        <View style={styles.externalSection}>
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
      <AppDialog
        visible={showNotificationDisclosure}
        title="다른 앱 알림 접근 안내"
        message={"Push Office가 다른 앱의 알림 제목과 본문을 읽을 수 있도록 Android 알림 접근 권한이 필요합니다. 인증번호 등 민감한 정보도 이 권한의 범위에 포함됩니다.\n\n일정과 관련된 알림을 기기 안에서만 추려 후보 제목·시각·앱 이름·원문 일부를 최대 24건, 48시간 동안 저장합니다. 사용자가 검토 후 승인한 일정만 등록합니다. 알림 원문은 외부 AI 서버로 보내지 않습니다. ML Kit는 별도로 식별자·진단 정보를 처리할 수 있습니다.\n\n권한과 기능 활성화는 선택 사항입니다. 앱 설정에서 기능을 끄면 후보 기록이 삭제되며 Android 권한도 시스템 설정에서 철회할 수 있습니다.\n\n이 내용을 이해하고 기능 설정을 계속하시겠습니까?"}
        confirmLabel={notificationFeature?.accessGranted ? '기능 설정으로 이동' : '확인 후 시스템 권한 설정'}
        cancelLabel="취소"
        onDismiss={() => setShowNotificationDisclosure(false)}
        onConfirm={() => {
          setShowNotificationDisclosure(false);
          if (notificationFeature?.accessGranted) router.push('/(tabs)/settings');
          else void PushOfficeNative.openNotificationAccessSettings().catch(e => showError(e, '알림 접근 설정을 열지 못했습니다.'));
        }}
      />
      </>
    );

}


const styles = StyleSheet.create({
  quickEntry: { gap: uiSpacing.xxs },
  quickEntryTools: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs },
  quickEntryHint: { ...uiTypography.caption, flex: 1, minWidth: 0 },
  voiceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: uiSizes.touchMinHeight,
    paddingHorizontal: uiSpacing.xs,
    gap: uiSpacing.xxs,
  },
  voiceActionText: { ...uiTypography.caption, fontWeight: '700' },
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
  externalSection: { gap: uiSpacing.sm, paddingTop: uiSpacing.xxs },
});
