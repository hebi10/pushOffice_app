import React, { useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { AssistantButton, AssistantTextField, assistantStyles as s } from '@/src/components/AssistantUI';
import { EmptyState } from '@/src/components/EmptyState';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { ScheduleCategoryOptions, type ScheduleCategoryFilter } from '@/src/components/schedule/ScheduleCategoryOptions';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useSchedules } from '@/src/features/schedules';
import { buildScheduleSearchIndex, filterScheduleIndex } from '@/src/features/schedules/scheduleSearch';
import { uiSpacing } from '@/src/lib/designTokens';

export default function ScheduleSearchScreen() {
  const { colors } = useTheme();
  const schedules = useSchedules();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ScheduleCategoryFilter>('all');
  const deferredQuery = useDeferredValue(query);
  const index = useMemo(() => buildScheduleSearchIndex(schedules.data ?? []), [schedules.data]);
  const results = useMemo(() => filterScheduleIndex(index, deferredQuery, category), [index, deferredQuery, category]);
  const updating = query !== deferredQuery;
  const unavailable = schedules.isLoading || schedules.isError;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={unavailable || updating ? [] : results}
      keyExtractor={(record, i) => record.id ?? ('local-' + i)}
      initialNumToRender={12}
      refreshing={schedules.isRefetching}
      onRefresh={() => { void schedules.refetch(); }}
      ItemSeparatorComponent={() => <View style={{ height: uiSpacing.xs }} />}
      ListHeaderComponent={
        <View style={{ gap: uiSpacing.sm, paddingBottom: uiSpacing.xs }}>
          <AssistantTextField label="일정 검색" value={query} onChangeText={setQuery}
            placeholder="제목, 장소, 메모 검색" maxLength={120} autoCapitalize="none" />
          <Text style={[s.caption, { color: colors.textSecondary }]}>카테고리</Text>
          <ScheduleCategoryOptions value={category} onChange={setCategory} includeAll />
          {query || category !== 'all' ? (
            <AssistantButton label="검색·필터 초기화" icon="close-outline" secondary
              onPress={() => { setQuery(''); setCategory('all'); }} />
          ) : null}
          <Text accessibilityLiveRegion="polite" style={[s.caption, { color: colors.textSecondary }]}>
            {schedules.isError ? '일정 조회 실패' : schedules.isLoading || updating ? '검색 중' : '검색 결과 ' + results.length + '건'}
            {'\n전체 저장 일정 · 시작일 최신순 · 반복 일정은 기준일 1건으로 표시'}
          </Text>
        </View>
      }
      renderItem={({ item }) => <ScheduleItem schedule={item} variant="search" />}
      ListEmptyComponent={
        schedules.isLoading ? <ActivityIndicator accessibilityLabel="일정 검색 중" color={colors.primary} /> :
        schedules.isError ? (
          <View style={{ gap: uiSpacing.sm }}>
            <EmptyState message="일정을 불러오지 못했습니다." />
            <AssistantButton label="다시 조회" icon="refresh-outline" secondary onPress={() => { void schedules.refetch(); }} />
          </View>
        ) : updating ? <ActivityIndicator accessibilityLabel="일정 검색 중" color={colors.primary} /> :
          <EmptyState message={index.length ? '검색 조건에 맞는 일정이 없습니다.' : '저장된 일정이 없습니다.'} />
      }
    />
  );
}
