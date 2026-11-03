import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
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
import { useFocusEffect } from 'expo-router';
import { ForegroundRequest, runForegroundRequest } from '@/src/features/notifications/foregroundRequest';
import { AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
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
    return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={schedules.isRefetching} onRefresh={() => { void schedules.refetch(); }}/>}>
  <View>
    <Text style={[s.caption, { color: colors.primary, fontWeight: '700' }]}>내 기기에 머무는 일정 비서</Text>
    <Text style={[s.heading, { color: colors.text, marginTop: 6 }]}>{new Date(now).getHours() < 12 ? '좋은 아침이에요' : '오늘도 차근차근'}</Text>
    <Text style={[s.subtitle, { color: colors.textSecondary, marginTop: 5 }]}>{dayjs(now).format('M월 D일 dddd')}</Text>
    </View>
  <AssistantButton label="텍스트 · 음성으로 일정 추가" icon="chatbubble-ellipses-outline" onPress={open}/>
  <AssistantCard title="오늘의 브리핑">
    <Text style={[s.body, { color: colors.text }]}>{refined || summary}</Text>
    <Text style={[s.caption, { color: colors.textSecondary }]}>{refined ? '기기 내 Gemini Nano로 정리한 요약' : '저장된 일정으로 바로 만든 로컬 요약'}</Text>{ai.status === 'available' && <AssistantButton label="기기 AI로 다듬기" icon="sparkles-outline" secondary busy={busy} onPress={refine}/>}<Text style={[s.caption, { color: colors.textSecondary }]}>Gemini Nano · {ai.message}</Text>
    </AssistantCard>
  {next && <AssistantCard title="다음 일정">
        <ScheduleItem schedule={next}/>
        </AssistantCard>}
  <AssistantCard title={`오늘 일정  ${todayItems.length}`}>
   {schedules.isError ? <Text style={{ color: colors.danger }}>일정을 불러오지 못했어요. 아래로 당겨 다시 확인해 주세요.</Text> : todayItems.length ? todayItems.map(x => <ScheduleItem key={x.id} schedule={x}/>) : <Text style={[s.body, { color: colors.textSecondary }]}>아직 일정이 없어요. “내일 오전 9시 회의”처럼 입력해 보세요.</Text>}
  </AssistantCard>
  <AssistantCard title="선택한 외부 브리핑">
    <Text style={[s.caption, { color: colors.textSecondary }]}>날씨·뉴스·주식은 설정에서 선택하고 직접 불러옵니다. 선택 항목과 지역·관심 종목은 외부 브리핑 서비스로 전송됩니다.</Text>
    <AssistantButton label="외부 브리핑 불러오기" icon="cloud-outline" secondary busy={external.isPending} onPress={() => external.mutate({ input: { ownerId: uid ?? 'local', ownerType: 'device', dateKey: today, timezone: settings.timezone, types: settings.digestTypes, city: settings.digestCity, stockTickers: settings.stockTickers, newsKeywords: settings.newsKeywords, newsLanguage: settings.newsLanguage, allowExternal: true }, force: true })}/>{external.isError && <Text style={{ color: colors.danger }}>외부 정보를 가져오지 못했어요. 로컬 일정은 계속 사용할 수 있습니다.</Text>}</AssistantCard>
  {external.data?.weatherData && <BriefingWeatherCard {...external.data.weatherData}/>}{external.data?.newsData && <BriefingNewsCard items={external.data.newsData}/>}{external.data?.stockData && <BriefingStockCard items={external.data.stockData}/>}
 </ScrollView>;
}
