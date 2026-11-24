import React, { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
import { EmptyState } from '@/src/components/EmptyState';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAdaptiveLayout } from '@/src/lib/useAdaptiveLayout';
import { useMonthSchedules, useWeekSchedules } from '@/src/features/schedules';
import { shiftCivilDate, weekDateKeys } from '@/src/features/schedules/calendarWeek';
import { retainSelectedDayInMonth } from '@/src/features/schedules/calendarSelection';
import { useClock } from '@/src/features/notifications/useNativeAssistant';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { dayjs } from '@/src/lib/time';
import { PushOfficeNative } from '@/modules/push-office-native';
import { showError } from '@/src/components/ui/toast';

LocaleConfig.locales.ko = {
  monthNames: Array.from({ length: 12 }, (_, i) => String(i + 1) + '월'),
  monthNamesShort: Array.from({ length: 12 }, (_, i) => String(i + 1) + '월'),
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

type DayMark = {
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
  dots?: { key: string; color: string; selectedDotColor: string }[];
};

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const layout = useAdaptiveLayout();
  const now = useClock();
  const [selected, setSelected] = useState(() => dayjs(now).format('YYYY-MM-DD'));
  const [month, setMonth] = useState(() => ({ year: dayjs(now).year(), month: dayjs(now).month() + 1 }));
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [calendarRevision, setCalendarRevision] = useState(0);
  const calendarScrollRef = useRef<ScrollView>(null);
  const agendaTop = useRef(0);
  const panelsTop = useRef(0);
  const scrollToSelectedAgenda = () => {
    calendarScrollRef.current?.scrollTo({
      y: Math.max(0, panelsTop.current + agendaTop.current - uiSizes.touchMinHeight * 2 - uiSpacing.sm),
      animated: false,
    });
  };
  const monthSchedules = useMonthSchedules(month.year, month.month, mode === 'month');
  const weekSchedules = useWeekSchedules(selected, mode === 'week');
  const schedules = mode === 'month' ? monthSchedules : weekSchedules;
  const weekDays = useMemo(() => weekDateKeys(selected), [selected]);
  const selectDay = (date: string) => {
    setSelected(date);
    setMonth({ year: Number(date.slice(0,4)), month: Number(date.slice(5,7)) });
  };
  const goToday = () => {
    selectDay(dayjs(now).format('YYYY-MM-DD'));
    setCalendarRevision(value => value + 1);
  };
  const monthStart = dayjs(new Date(month.year, month.month - 1, 1)).format('YYYY-MM-DD');
  const calendarTheme = useMemo(() => ({
    calendarBackground: colors.surface,
    dayTextColor: colors.text,
    monthTextColor: colors.text,
    todayTextColor: colors.primary,
    arrowColor: colors.primary,
    textDisabledColor: colors.textTertiary,
    textSectionTitleColor: colors.textSecondary,
    selectedDayTextColor: colors.onPrimary,
    textDayFontSize: 15,
    textMonthFontSize: 16,
    textMonthFontWeight: '700' as const,
    textDayHeaderFontSize: 12,
    'stylesheet.calendar.main': {
      week: { marginTop: 1, marginBottom: 1, flexDirection: 'row' as const, justifyContent: 'space-around' as const },
    },
    'stylesheet.calendar.header': {
      week: { marginTop: 2, marginBottom: 0, flexDirection: 'row' as const, justifyContent: 'space-around' as const },
      dayTextAtIndex0: { color: colors.danger },
      dayTextAtIndex6: { color: colors.primary },
    },
  }), [colors]);

  const marks = useMemo(() => {
    const counts = new Map<string, number>();
    const dotColors = [colors.primary, colors.success, isDark ? '#FBBF24' : '#D97706'];
    for (const item of schedules.data ?? []) {
      const date = dayjs(item.startAt.toDate()).format('YYYY-MM-DD');
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    const result: Record<string, DayMark> = {};
    for (const [date, count] of counts) {
      result[date] = {
        dots: Array.from({ length: Math.min(count, 3) }, (_, index) => ({
          key: 'appointment-' + index,
          color: dotColors[index],
          selectedDotColor: colors.onPrimary,
        })),
      };
    }
    result[selected] = {
      ...result[selected],
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.onPrimary,
    };
    return result;
  }, [schedules.data, selected, colors.primary, colors.success, colors.onPrimary, isDark]);

  const items = useMemo(() => (
    (schedules.data ?? [])
      .filter(item => dayjs(item.startAt.toDate()).format('YYYY-MM-DD') === selected)
      .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis())
  ), [schedules.data, selected]);
  const selectedLabel = dayjs(selected).format('M월 D일 dddd');
  const summary = schedules.isError
    ? '조회 오류'
    : schedules.isLoading ? '확인 중' : String(items.length) + '건';

  return (
    <ScrollView
      ref={calendarScrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[s.content,{maxWidth:layout.contentMaxWidth}]}
      refreshControl={<RefreshControl refreshing={schedules.isRefetching} onRefresh={() => { void schedules.refetch(); }} />}
    >
      <ScreenIntro title="캘린더" compact />
      <View style={styles.calendarActions}>
        <View style={styles.searchAction}><AssistantButton label="전체 일정 검색" icon="search-outline" secondary onPress={() => router.push('/schedule-search')} /></View>
        <AssistantButton label="오늘" icon="today-outline" secondary onPress={goToday} />
      </View>
      <View accessibilityRole="radiogroup" style={styles.modeRow}>
        {(['month', 'week'] as const).map(value => (
          <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
            accessibilityLabel={value === 'month' ? '월간 일정' : '주간 일정'}
            onPress={() => { setMode(value); setCalendarRevision(n => n+1); }}
            style={[styles.modeChoice,{borderColor: mode === value ? colors.primary : colors.inputBorder,
              backgroundColor: mode === value ? colors.primaryLight : colors.surface}]}>
            <Text style={[s.body,{color:colors.text,fontWeight:mode===value?'700':'400'}]}>{value==='month'?'월간':'주간'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.calendarPanels, layout.twoPane && styles.calendarPanelsWide]}
        onLayout={event => { panelsTop.current = event.nativeEvent.layout.y; }}>
      <View style={[styles.calendarSurface, layout.twoPane && styles.calendarPane, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {mode === 'month' ? <Calendar
          key={(isDark ? 'dark' : 'light') + calendarRevision}
          current={monthStart}
          enableSwipeMonths
          markingType="multi-dot"
          onMonthChange={date => {
            setMonth({ year: date.year, month: date.month });
            setSelected(previous => retainSelectedDayInMonth(previous, date.year, date.month));
          }}
          onDayPress={date => setSelected(date.dateString)}
          markedDates={marks}
          monthFormat="yyyy년 M월"
          theme={calendarTheme}
        /> : (
          <View style={styles.weekPanel}>
            <View style={styles.weekHeader}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="이전 주" onPress={() => selectDay(shiftCivilDate(selected,-7))} style={styles.weekNav}>
                <Ionicons name="chevron-back" size={22} color={colors.primary}/>
              </TouchableOpacity>
              <Text style={[s.body,{color:colors.text,flex:1,textAlign:'center',fontWeight:'700'}]}>
                {dayjs(weekDays[0]).format('M월 D일')} – {dayjs(weekDays[6]).format('M월 D일')}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="다음 주" onPress={() => selectDay(shiftCivilDate(selected,7))} style={styles.weekNav}>
                <Ionicons name="chevron-forward" size={22} color={colors.primary}/>
              </TouchableOpacity>
            </View>
            <View style={styles.weekDays}>
              {weekDays.map(date => {
                const count = (schedules.data ?? []).filter(item => dayjs(item.startAt.toDate()).format('YYYY-MM-DD') === date).length;
                return <TouchableOpacity key={date} accessibilityRole="button" accessibilityState={{ selected: date===selected }}
                  accessibilityLabel={dayjs(date).format('M월 D일 dddd')+', 일정 '+count+'건'}
                  onPress={() => selectDay(date)}
                  style={[styles.weekDay,{backgroundColor:date===selected?colors.primary:colors.surface}]}>
                  <Text style={[s.caption,{color:date===selected?colors.onPrimary:colors.textSecondary}]}>{dayjs(date).format('dd')}</Text>
                  <Text style={[s.body,{color:date===selected?colors.onPrimary:colors.text,fontWeight:'700'}]}>{dayjs(date).date()}</Text>
                  <Text style={[s.caption,{color:date===selected?colors.onPrimary:colors.textSecondary}]}>{schedules.isLoading || schedules.isError ? '–' : count+'건'}</Text>
                </TouchableOpacity>;
              })}
            </View>
          </View>
        )}
        {mode === 'month' && !schedules.isError && (schedules.data?.length ?? 0) > 0 ? (
          <Text
            accessibilityLabel="날짜 아래 점은 일정 개수(최대 3개)를 표시합니다. 날짜를 선택해 일정을 확인하세요."
            numberOfLines={1}
            style={[styles.markHint, { color: colors.textSecondary }]}
          >
            점은 일정 건수를 나타냅니다 (최대 3개)
          </Text>
        ) : null}
        <View style={[styles.selectionPanel, { backgroundColor: colors.inputBackground }, layout.narrow && styles.selectionStack]}>
          <View
            style={styles.selectionSummary}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={selectedLabel + ', 일정 ' + summary}
          >
            <Ionicons name="calendar-clear-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.selectionTitle, { color: colors.text }]} numberOfLines={1}>{selectedLabel}</Text>
            <View style={styles.countBadge}>
              <Text style={[styles.countText, { color: colors.textSecondary }]}>일정 {summary}</Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`선택 날짜 일정 목록으로 이동: ${selectedLabel}`}
            accessibilityHint="현재 선택한 날짜의 일정 목록이 보이도록 스크롤합니다."
            onPress={scrollToSelectedAgenda}
            style={styles.agendaJumpAction}
          >
            <Text style={[styles.jumpText, { color: colors.primary }]}>목록</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <View
        style={[styles.agendaSection, layout.twoPane && styles.calendarPane]}
        onLayout={event => { agendaTop.current = event.nativeEvent.layout.y; }}
      >
      <AssistantButton
        label="빠른 일정 입력"
        icon="add-circle-outline"
        onPress={() => PushOfficeNative.openQuickEntryForDate(selected).catch(e => showError(e, '입력 창을 열 수 없습니다.'))}
      />
      <AssistantCard title="해당 날짜의 일정" icon="list-outline" flat>
        {schedules.isLoading ? (
          <Text style={[s.body, { color: colors.textSecondary }]}>일정 목록을 불러오는 중입니다.</Text>
        ) : schedules.isError ? (
          <View style={{gap:uiSpacing.xs}}>
            <Text style={[s.body, { color: colors.danger }]}>일정을 불러오지 못했습니다.</Text>
            <AssistantButton label="일정 다시 조회" icon="refresh-outline" secondary onPress={() => { void schedules.refetch(); }} />
          </View>
        ) : items.length ? (
          items.map(item => (
            <ScheduleItem
              key={item.id + '-' + item.startAt.toMillis()}
              schedule={item}
              variant="calendar"
            />
          ))
        ) : (
          <EmptyState message="선택한 날짜에 일정이 없습니다." />
        )}
      </AssistantCard>
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  calendarPanels: { gap:uiSpacing.sm },
  calendarPanelsWide: { flexDirection:'row', alignItems:'flex-start' },
  calendarPane: { flex:1,minWidth:0 },
  calendarActions: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs },
  searchAction: { flex: 1, minWidth: 0 },
  modeRow: { flexDirection: 'row', gap: uiSpacing.xs },
  modeChoice: { flex:1, minHeight: uiSizes.touchMinHeight, justifyContent:'center', alignItems:'center', borderWidth:uiSizes.borderWidth, borderRadius:uiRadii.field, padding:uiSpacing.xs },
  weekPanel: { padding: uiSpacing.xs, gap: uiSpacing.xxs },
  weekHeader: { flexDirection:'row',alignItems:'center',gap:uiSpacing.xxs },
  weekNav: { minWidth:uiSizes.touchMinHeight,minHeight:uiSizes.touchMinHeight,alignItems:'center',justifyContent:'center' },
  weekDays: { flexDirection:'row', flexWrap:'wrap', gap:uiSpacing.xxs },
  weekDay: { flex:1, minWidth:uiSizes.touchMinHeight,minHeight:76,alignItems:'center',justifyContent:'center',paddingVertical:uiSpacing.xs,gap:uiSpacing.xxs,borderRadius:uiRadii.field },
  calendarSurface: {
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.card,
    overflow: 'hidden',
    paddingTop: 0,
    paddingBottom: 0,
  },
  selectionStack: { flexWrap:'wrap' },
  selectionPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.xxs,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.xxs,
  },
  agendaSection: { gap: uiSpacing.xs },
  markHint: {
    ...uiTypography.caption,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.xxs,
  },
  selectionSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.xxs,
    minHeight: uiSizes.touchMinHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  selectionTitle: { ...uiTypography.body, flex: 1, minWidth: 0, fontWeight: '700' },
  agendaJumpAction: {
    minHeight: uiSizes.touchMinHeight,
    minWidth: uiSizes.touchMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiSpacing.xxs,
    paddingHorizontal: uiSpacing.xxs,
  },
  jumpText: { ...uiTypography.caption, fontWeight: '700' },
  countBadge: {
    minWidth: 56,
    minHeight: 30,
    paddingHorizontal: uiSpacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: { ...uiTypography.body, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
