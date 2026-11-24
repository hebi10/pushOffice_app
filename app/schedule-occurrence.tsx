import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantButton, AssistantCard, AssistantTextField, assistantStyles as s } from '@/src/components/AssistantUI';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { EmptyState } from '@/src/components/EmptyState';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useScheduleDetail } from '@/src/features/schedules';
import { projectOccurrences, toNativeSchedule } from '@/src/features/schedules/scheduleCodec';
import { PushOfficeNative } from '@/modules/push-office-native';
import { dayjs } from '@/src/lib/time';
import { showError, showNotice, showToast } from '@/src/components/ui/toast';

type Action = 'edit' | 'delete' | 'complete';
const FORMAT = 'YYYY-MM-DD HH:mm';
function parseLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) throw new Error('YYYY-MM-DD HH:mm 형식으로 입력해 주세요.');
  const parsed = new Date(value.replace(' ', 'T') + ':00');
  if (!Number.isFinite(parsed.getTime()) || dayjs(parsed).format(FORMAT) !== value) throw new Error('날짜와 시간을 확인해 주세요.');
  return parsed.getTime();
}

export default function ScheduleOccurrenceScreen() {
  const {id, at: rawAt} = useLocalSearchParams<{id: string; at: string}>();
  const at = typeof rawAt === 'string' && /^\d{1,15}$/.test(rawAt) ? Number(rawAt) : NaN;
  const detail = useScheduleDetail(id);
  const query = useQueryClient();
  const { colors } = useTheme();
  const occurrence = useMemo(() => {
    if (!detail.data || !Number.isSafeInteger(at) || at < 0 || at > 253402300799999 ||
        detail.data.repeatType === 'none' || detail.data.completedAt != null) return null;
    return projectOccurrences([toNativeSchedule(detail.data)], new Date(at), new Date(at+1))[0] ?? null;
  }, [detail.data, at]);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [confirm, setConfirm] = useState<Action | null>(null);
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: ({action, updated, replacement}: {action: Action; updated: number; replacement: {title?: string;startAt?: number;endAt?: number | null}}) =>
      PushOfficeNative.mutateScheduleOccurrence(id, at, updated, action, replacement),
    onSuccess: async () => { await query.invalidateQueries({queryKey:['schedules']}); },
  });
  useEffect(() => {
    if (!occurrence) return;
    setTitle(occurrence.title);
    setStart(dayjs(occurrence.startAt).format(FORMAT));
    setEnd(occurrence.endAt == null ? '' : dayjs(occurrence.endAt).format(FORMAT));
  }, [occurrence]);

  const apply = async (action: Action) => {
    if (!detail.data || !occurrence || inFlight.current) return;
    inFlight.current = true;
    try {
      const replacement = action === 'edit' ? {
        title: title.trim(), startAt: parseLocal(start.trim()), endAt: end.trim() ? parseLocal(end.trim()) : null,
      } : {};
      if (action === 'edit' && (!replacement.title || (replacement.endAt != null && replacement.endAt <= replacement.startAt!))) {
        throw new Error('일정 제목과 시작·종료 시간을 확인해 주세요.');
      }
      if (action === 'edit' && occurrence.isAllDay && !start.trim().endsWith(' 00:00')) throw new Error('종일 일정의 시작 시간은 00:00으로 입력해 주세요.');
      const result = await mutation.mutateAsync({action, updated:detail.data.updatedAt.toMillis(), replacement});
      if (!result.alarmsReady || !result.widgetsReady) showNotice('회차 변경 완료', '일정은 저장했습니다. 설정에서 알림과 위젯을 다시 확인해 주세요.');
      else showToast(action === 'delete' ? '이 회차를 삭제했습니다.' : action === 'complete' ? '이 회차를 완료했습니다.' : '이 회차를 독립 일정으로 저장했습니다.');
      if (result.detachedId) router.replace(`/schedule/${result.detachedId}`);
      else router.back();
    } catch(error) { showError(error,'회차를 변경하지 못했습니다.'); }
    finally { inFlight.current = false; }
  };

  return (
    <ScrollView style={{flex:1,backgroundColor:colors.background}} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {detail.isLoading ? <ActivityIndicator accessibilityLabel="회차 불러오는 중" color={colors.primary}/> : detail.isError || !occurrence ? (
        <EmptyState message="회차를 찾을 수 없습니다. 일정이 변경되었거나 이미 제외되었을 수 있습니다." />
      ) : (
        <>
          <AssistantCard title="선택한 반복 일정" icon="repeat-outline">
            <Text style={[s.body,{color:colors.text}]}>{occurrence.title}</Text>
            <Text style={[s.caption,{color:colors.textSecondary}]}>{dayjs(at).format('YYYY년 M월 D일 (ddd) HH:mm')}</Text>
            <Text style={[s.caption,{color:colors.textSecondary}]}>개별 수정 또는 완료 시 원본 반복 회차를 제외하고 독립 일정으로 분리합니다. 다른 회차에는 영향을 주지 않습니다.</Text>
            <AssistantButton label="전체 반복 일정 관리" icon="repeat-outline" secondary disabled={mutation.isPending} onPress={() => router.push(`/schedule/${id}`)} />
          </AssistantCard>
          <AssistantCard title="이 회차만 수정" icon="create-outline">
            <AssistantTextField label="제목" value={title} onChangeText={setTitle} maxLength={500}/>
            <AssistantTextField label="시작 (YYYY-MM-DD HH:mm)" value={start} onChangeText={setStart} maxLength={16}/>
            <AssistantTextField label="종료 (선택)" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD HH:mm" maxLength={16}/>
            <Text style={[s.caption,{color:colors.textSecondary}]}>장소·메모·카테고리·알림 설정은 그대로 유지됩니다. 분리 후 일정 상세에서 변경할 수 있습니다.</Text>
            <AssistantButton label="이 회차만 저장" icon="checkmark-outline" busy={mutation.isPending} onPress={() => setConfirm('edit')}/>
          </AssistantCard>
          <AssistantButton label="이 회차만 완료" icon="checkmark-circle-outline" secondary disabled={mutation.isPending} onPress={() => setConfirm('complete')}/>
          <AssistantButton label="이 회차만 삭제" icon="trash-outline" variant="destructive" disabled={mutation.isPending} onPress={() => setConfirm('delete')}/>
        </>
      )}
      <AssistantButton label="돌아가기" icon="arrow-back-outline" secondary disabled={mutation.isPending} onPress={() => router.back()}/>
      <AppDialog visible={confirm !== null}
        title={confirm === 'delete' ? '이 회차만 삭제' : confirm === 'complete' ? '이 회차만 완료' : '이 회차만 수정'}
        message={confirm === 'delete' ? '선택한 회차와 해당 알림만 제외합니다. 나머지 반복 일정은 유지됩니다.' : confirm === 'complete' ? '선택한 회차를 완료된 독립 일정으로 분리합니다. 편집 중인 내용은 적용하지 않습니다.' : '선택한 회차를 수정한 독립 일정으로 분리합니다. 이후 전체 반복 일정을 수정해도 분리한 일정은 바뀌지 않습니다.'}
        destructive={confirm === 'delete'} confirmLabel="확인" onDismiss={() => setConfirm(null)}
        onConfirm={() => { const action = confirm; setConfirm(null); if(action) void apply(action); }}/>
    </ScrollView>
  );
}
