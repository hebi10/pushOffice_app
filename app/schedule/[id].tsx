import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useScheduleDetail, useUpdateSchedule, useDeleteSchedule } from '@/src/features/schedules';
import { PushOfficeNative } from '@/modules/push-office-native';
import { dayjs } from '@/src/lib/time';
import { showError, showToast } from '@/src/components/ui/toast';
import type { RepeatType } from '@/src/types';
export default function ScheduleDetail() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const detail = useScheduleDetail(id);
    const update = useUpdateSchedule();
    const remove = useDeleteSchedule();
    const { colors } = useTheme();
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [end, setEnd] = useState('');
    const [allDay, setAllDay] = useState(false);
    const [notification, setNotification] = useState(true);
    const [repeat, setRepeat] = useState<RepeatType>('none');
    useEffect(() => { const r = detail.data; if (!r)
        return; setTitle(r.title); setDate(dayjs(r.startAt.toDate()).format('YYYY-MM-DD')); setTime(dayjs(r.startAt.toDate()).format('HH:mm')); setEnd(r.endAt ? dayjs(r.endAt.toDate()).format('YYYY-MM-DD HH:mm') : ''); setAllDay(!!r.isAllDay); setNotification(r.notificationEnabled); setRepeat(r.repeatType); }, [detail.data]);
    const parse = (value: string) => { if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
        throw new Error('날짜는 YYYY-MM-DD, 시간은 HH:mm 형식으로 입력해 주세요.'); const result = new Date(value.replace(' ', 'T') + ':00'); if (!Number.isFinite(result.getTime()) || dayjs(result).format('YYYY-MM-DD HH:mm') !== value)
        throw new Error('실제 존재하는 날짜와 시간을 입력해 주세요.'); return result; };
    const save = async () => { try {
        const start = parse(`${date} ${allDay ? '00:00' : time}`);
        const finish = end.trim() ? parse(end.trim()) : null;
        await update.mutateAsync({ id, data: { title, startAt: Timestamp.fromDate(start), endAt: finish ? Timestamp.fromDate(finish) : null, isAllDay: allDay, repeatType: repeat, notificationEnabled: notification } });
        showToast('일정을 수정했어요.');
    }
    catch (e) {
        showError(e, '저장하지 못했어요.');
    } };
    const confirmSave = () => { if (detail.data?.repeatType !== 'none' || repeat !== 'none')
        Alert.alert('반복 일정 전체 수정', '이 일정의 모든 반복에 적용됩니다. 원래 날짜를 바꾸면 반복 기준 날짜도 바뀝니다.', [{ text: '취소', style: 'cancel' }, { text: '전체 수정', onPress: () => { void save(); } }]);
    else
        void save(); };
    const field = (label: string, value: string, onChangeText: (x: string) => void, placeholder?: string) => <View style={{ gap: 6 }}>
    <Text style={[s.caption, { color: colors.textSecondary }]}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textTertiary} style={[s.input, { color: colors.text, borderColor: colors.divider, backgroundColor: colors.background }]}/>
    </View>;
    if (!detail.data)
        return <View style={s.content}>
        <Text style={{ color: colors.text }}>{detail.isLoading ? '일정을 불러오는 중…' : '일정을 찾을 수 없어요. 삭제되었을 수 있습니다.'}</Text>
        </View>;
    return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <AssistantCard title="일정 수정">{field('제목', title, setTitle)}{field('날짜 (YYYY-MM-DD)', date, setDate)}<View style={s.row}>
    <Text style={{ color: colors.text }}>하루 종일</Text>
    <Switch accessibilityLabel="하루 종일" value={allDay} onValueChange={setAllDay}/>
    </View>{!allDay && field('시작 시간 (HH:mm)', time, setTime)}{field('종료 날짜와 시간 (선택)', end, setEnd, '2026-11-03 15:00')}<View style={s.row}>
    <Text style={{ color: colors.text }}>일정 알림</Text>
    <Switch accessibilityLabel="일정 알림" value={notification} onValueChange={setNotification}/>
    </View>
    <Text style={[s.caption, { color: colors.textSecondary }]}>알림은 기기 권한과 전체 알림 설정에 따라 전달됩니다.</Text>
    <Text style={{ color: colors.text }}>반복</Text>
    <View style={{ gap: 8 }}>{([['none', '반복 안 함'], ['monthly', '매월 · 전체 반복'], ['yearly', '매년 · 전체 반복']] as const).map(([key, label]) => <AssistantButton key={key} label={`${repeat === key ? '✓ ' : ''}${label}`} secondary={repeat !== key} onPress={() => setRepeat(key)} icon="repeat"/>)}</View>
    <AssistantButton label="변경 사항 저장" icon="checkmark" busy={update.isPending} onPress={confirmSave}/>
    </AssistantCard>
 <AssistantCard title="재알림">
    <Text style={[s.caption, { color: colors.textSecondary }]}>반복 기준 날짜를 바꾸지 않고 다시 알려드려요.</Text>
    <AssistantButton label="10분 뒤 다시 알림" icon="alarm-outline" secondary onPress={() => PushOfficeNative.snoozeSchedule(id, 10).then(() => showToast('10분 뒤 재알림을 예약했어요.')).catch(e => showError(e, '예약하지 못했어요.'))}/>
    <AssistantButton label="재알림 취소" icon="close-outline" secondary onPress={() => PushOfficeNative.cancelSnooze(id).then(() => showToast('재알림을 취소했어요.')).catch(e => showError(e, '취소하지 못했어요.'))}/>
    </AssistantCard>
 <AssistantButton label={detail.data.repeatType === 'none' ? '일정 삭제' : '전체 반복 일정 삭제'} secondary icon="trash-outline" busy={remove.isPending} onPress={() => Alert.alert('일정 삭제', detail.data?.repeatType === 'none' ? '일정과 알림을 삭제합니다.' : '전체 반복 일정과 모든 알림을 삭제합니다.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => remove.mutateAsync(id).then(() => router.back()).catch(e => showError(e, '삭제하지 못했어요.')) }])}/>
 </ScrollView>;
}
