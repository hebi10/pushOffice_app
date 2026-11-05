import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
import { EmptyState } from '@/src/components/EmptyState';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useMonthSchedules } from '@/src/features/schedules';
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
  const now = useClock();
  const [selected, setSelected] = useState(() => dayjs(now).format('YYYY-MM-DD'));
  const [month, setMonth] = useState(() => ({ year: dayjs(now).year(), month: dayjs(now).month() + 1 }));
  const schedules = useMonthSchedules(month.year, month.month);
  const monthStart = dayjs(new Date(month.year, month.month - 1, 1)).format('YYYY-MM-DD');

  const marks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of schedules.data ?? []) {
      const date = dayjs(item.startAt.toDate()).format('YYYY-MM-DD');
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    const result: Record<string, DayMark> = {};
    for (const [date, count] of counts) {
      result[date] = {
        dots: Array.from({ length: Math.min(count, 3) }, (_, index) => ({
          key: 'appointment-' + index,
          color: colors.primary,
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
  }, [schedules.data, selected, colors.primary, colors.onPrimary]);

  const items = useMemo(() => (
    (schedules.data ?? []).filter(item => dayjs(item.startAt.toDate()).format('YYYY-MM-DD') === selected)
  ), [schedules.data, selected]);
  const selectedLabel = dayjs(selected).format('M월 D일 dddd');
  const summary = schedules.isError
    ? '조회 오류'
    : schedules.isLoading ? '확인 중' : String(items.length) + '건';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
    >
      <ScreenIntro
        eyebrow="PUSH OFFICE · 일정"
        title="일정 · 캘린더"
        description="날짜를 선택해 일정을 확인하세요."
        artwork={require('@/assets/images/illustration-calendar.jpg')}
      />
      <View style={[styles.calendarSurface, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Calendar
          key={isDark ? 'dark' : 'light'}
          current={monthStart}
          enableSwipeMonths
          markingType="multi-dot"
          onMonthChange={date => {
            setMonth({ year: date.year, month: date.month });
            setSelected(date.dateString.slice(0, 7) + '-01');
          }}
          onDayPress={date => setSelected(date.dateString)}
          markedDates={marks}
          monthFormat="yyyy년 M월"
          theme={{
            calendarBackground: colors.surface,
            dayTextColor: colors.text,
            monthTextColor: colors.text,
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            textDisabledColor: colors.textTertiary,
            textSectionTitleColor: colors.textSecondary,
            selectedDayTextColor: colors.onPrimary,
            textDayFontSize: 15,
            textMonthFontSize: 17,
            textMonthFontWeight: '700',
            textDayHeaderFontSize: 13,
          }}
        />
        <Text style={[styles.markHint, { color: colors.textSecondary }]}>
          날짜 아래 점은 일정 개수이며, 3개 이상은 점 3개로 표시됩니다.
        </Text>
      </View>
      <View
        style={[styles.selectionSummary, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
        accessibilityLabel={selectedLabel + ', 일정 ' + summary}
      >
        <Ionicons name="calendar-clear-outline" size={22} color={colors.primary} />
        <View style={styles.selectionCopy}>
          <Text style={[styles.selectionTitle, { color: colors.text }]}>{selectedLabel}</Text>
          <Text style={[styles.selectionDetail, { color: colors.textSecondary }]}>선택한 날짜의 일정</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.countText, { color: colors.primary }]}>{summary}</Text>
        </View>
      </View>
      <AssistantButton
        label="빠른 일정 입력"
        icon="add-circle-outline"
        onPress={() => PushOfficeNative.openQuickEntry().catch(e => showError(e, '입력 창을 열 수 없습니다.'))}
      />
      <AssistantCard title="해당 날짜의 일정" icon="list-outline">
        {schedules.isLoading ? (
          <Text style={[s.body, { color: colors.textSecondary }]}>일정 목록을 불러오는 중입니다.</Text>
        ) : schedules.isError ? (
          <Text style={[s.body, { color: colors.danger }]}>일정을 불러오지 못했습니다.</Text>
        ) : items.length ? (
          items.map(item => (
            <ScheduleItem
              key={item.id + '-' + item.startAt.toMillis()}
              schedule={item}
              variant="calendar"
            />
          ))
        ) : (
          <EmptyState message="이 날짜에 등록된 일정이 없습니다. 빠른 입력으로 일정을 추가해 보세요." />
        )}
      </AssistantCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  calendarSurface: {
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.card,
    overflow: 'hidden',
    paddingTop: uiSpacing.xs,
    paddingBottom: uiSpacing.sm,
  },
  markHint: { ...uiTypography.caption, paddingHorizontal: uiSpacing.md, paddingTop: uiSpacing.xs },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.sm,
    minHeight: 64,
    borderRadius: uiRadii.field,
    borderWidth: uiSizes.borderWidth,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  selectionCopy: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  selectionTitle: { ...uiTypography.sectionTitle },
  selectionDetail: uiTypography.caption,
  countBadge: {
    minWidth: 56,
    minHeight: uiSizes.touchMinHeight,
    paddingHorizontal: uiSpacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: uiRadii.field,
  },
  countText: { ...uiTypography.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
