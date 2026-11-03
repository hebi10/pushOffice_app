import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useMonthSchedules } from '@/src/features/schedules';
import { useClock } from '@/src/features/notifications/useNativeAssistant';
import { dayjs } from '@/src/lib/time';
import { PushOfficeNative } from '@/modules/push-office-native';
import { showError } from '@/src/components/ui/toast';
LocaleConfig.locales.ko = { monthNames: Array.from({ length: 12 }, (_, i) => `${i + 1}월`), monthNamesShort: Array.from({ length: 12 }, (_, i) => `${i + 1}월`), dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'], dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'], today: '오늘' };
LocaleConfig.defaultLocale = 'ko';
export default function CalendarScreen() {
    const { colors, isDark } = useTheme();
    const now = useClock();
    const [selected, setSelected] = useState(() => dayjs(now).format('YYYY-MM-DD'));
    const [month, setMonth] = useState(() => ({ year: dayjs(now).year(), month: dayjs(now).month() + 1 }));
    const schedules = useMonthSchedules(month.year, month.month);
    const marks = useMemo(() => { const result: Record<string, {
        marked?: boolean;
        dotColor?: string;
        selected?: boolean;
        selectedColor?: string;
    }> = {}; for (const item of schedules.data ?? []) {
        result[dayjs(item.startAt.toDate()).format('YYYY-MM-DD')] = { marked: true, dotColor: colors.primary };
    } result[selected] = { ...result[selected], selected: true, selectedColor: colors.primary }; return result; }, [schedules.data, selected, colors.primary]);
    const items = (schedules.data ?? []).filter(x => dayjs(x.startAt.toDate()).format('YYYY-MM-DD') === selected);
    return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 36 }}>
  <Calendar key={isDark ? 'dark' : 'light'} current={`${month.year}-${String(month.month).padStart(2, '0')}-01`} onMonthChange={x => { setMonth({ year: x.year, month: x.month }); setSelected(`${x.year}-${String(x.month).padStart(2, '0')}-01`); }} onDayPress={x => setSelected(x.dateString)} markedDates={marks} monthFormat="yyyy년 M월" theme={{ calendarBackground: colors.surface, dayTextColor: colors.text, monthTextColor: colors.text, todayTextColor: colors.primary, arrowColor: colors.primary, textDisabledColor: colors.textTertiary, textSectionTitleColor: colors.textSecondary }}/>
  <View style={s.content}>
    <View>
    <Text style={[s.heading, { fontSize: 23, color: colors.text }]}>{dayjs(selected).format('M월 D일 dddd')}</Text>
    <Text style={[s.subtitle, { color: colors.textSecondary }]}>반복 일정도 해당 날짜에 함께 표시해요.</Text>
    </View>
    <AssistantButton label="빠른 일정 입력 열기" icon="add" onPress={() => PushOfficeNative.openQuickEntry().catch(e => showError(e, '입력 창을 열 수 없습니다.'))}/>
    <AssistantCard title={`일정 ${items.length}개`}>{schedules.isError ? <Text style={{ color: colors.danger }}>일정을 불러오지 못했어요.</Text> : items.length ? items.map(x => <ScheduleItem key={x.id} schedule={x}/>) : <Text style={[s.body, { color: colors.textSecondary }]}>이 날짜에 등록된 일정이 없어요.{'\n'}빠른 입력에서 날짜와 시간을 확인하고 저장해 주세요.</Text>}</AssistantCard>
    </View>
 </ScrollView>;
}
