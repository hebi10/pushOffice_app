/**
 * Home 화면 – 자연어 일정 등록 + 오늘/다가오는 일정
 */
import { EmptyState } from '@/src/components/EmptyState';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { showError, showToast } from '@/src/components/ui/toast';
import {
    canScheduleMore,
    requestNotificationPermission,
    rescheduleOverdueRepeating,
    scheduleNotification,
} from '@/src/features/notifications';
import { aiParse, localParse } from '@/src/features/parsing';
import { useCreateSchedule, useSchedules } from '@/src/features/schedules';
import { dayjs, getUserTimezone, nowISO } from '@/src/lib/time';
import { useAppSelector } from '@/src/store/store';
import type { ChatMessage, ParseResult } from '@/src/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const { data: schedules, isLoading } = useSchedules();
  const createMutation = useCreateSchedule();

  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingParse, setPendingParse] = useState<ParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 앱 진입 시 반복 일정 재스케줄
  useEffect(() => {
    if (uid) {
      rescheduleOverdueRepeating(uid).catch(console.error);
      requestNotificationPermission().catch(console.error);
    }
  }, [uid]);

  // 오늘 + 다가오는 일정 필터
  const todayStart = dayjs().startOf('day');
  const todayEnd = dayjs().endOf('day');

  const todaySchedules = (schedules ?? []).filter((s) => {
    const d = dayjs(s.startAt?.toDate?.());
    return d.isAfter(todayStart) && d.isBefore(todayEnd);
  });

  const upcomingSchedules = (schedules ?? []).filter((s) => {
    const d = dayjs(s.startAt?.toDate?.());
    return d.isAfter(todayEnd);
  }).slice(0, 10);

  const addChat = useCallback(
    (role: ChatMessage['role'], text: string, scheduleData?: Partial<ParseResult>) => {
      const msg: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(),
        role,
        text,
        timestamp: Date.now(),
        scheduleData,
      };
      setChatMessages((prev) => [...prev, msg]);
    },
    [],
  );

  /** 전송 처리 */
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !uid) return;
    const text = inputText.trim();
    setInputText('');
    addChat('user', text);
    setIsProcessing(true);

    try {
      // 1) 로컬 파싱
      const tz = getUserTimezone();
      const result = localParse(text, tz);

      // 누락 필드가 날짜와 제목만 없으면 추가 질문
      if (result.missingFields.length === 0 && result.startAtISO) {
        // 완전 파싱 성공 → 즉시 저장 확인
        setPendingParse(result);
        const title = result.titleCandidate || text;
        const dateStr = dayjs(result.startAtISO).format('M월 D일 (ddd) HH:mm');
        const repeatLabel = result.repeatType === 'none' ? '' : ` (${result.repeatType === 'monthly' ? '매월' : '매년'} 반복)`;
        addChat(
          'assistant',
          `📌 "${title}"\n📆 ${dateStr}${repeatLabel}\n\n이대로 저장할까요? (네/아니오)`,
          result,
        );
      } else if (result.startAtISO && result.missingFields.length <= 1) {
        // 부분 파싱 → 누락 필드 질문
        setPendingParse(result);
        const questions = result.missingFields.map((f) => {
          if (f === 'title') return '일정 제목을 알려주세요.';
          if (f === 'time') return '몇 시에 알려드릴까요? (기본: 오전 9시)';
          return `${f}을(를) 알려주세요.`;
        });
        addChat('assistant', questions.join('\n'));
      } else {
        // 2) AI 파싱 시도
        try {
          const aiResult = await aiParse({ text, timezone: tz, nowISO: nowISO(tz) });
          if (aiResult.followUpQuestions.length > 0) {
            addChat('assistant', aiResult.followUpQuestions.join('\n'));
            setPendingParse({
              titleCandidate: aiResult.title,
              startAtISO: aiResult.startAtISO,
              repeatType: aiResult.repeatType,
              missingFields: aiResult.missingFields,
            });
          } else if (aiResult.startAtISO) {
            const parsed: ParseResult = {
              titleCandidate: aiResult.title,
              startAtISO: aiResult.startAtISO,
              repeatType: aiResult.repeatType,
              missingFields: [],
            };
            setPendingParse(parsed);
            const dateStr = dayjs(aiResult.startAtISO).format('M월 D일 (ddd) HH:mm');
            addChat(
              'assistant',
              `📌 "${aiResult.title}"\n📆 ${dateStr}\n\n이대로 저장할까요? (네/아니오)`,
              parsed,
            );
          } else {
            addChat('assistant', '일정 정보를 이해하지 못했어요. 다시 입력해 주세요.');
          }
        } catch {
          // AI 호출 실패 → 날짜/시간만이라도 있으면 진행
          addChat(
            'assistant',
            '자세한 분석이 어렵습니다. 날짜와 시간을 포함해서 다시 입력해 주세요.\n예) "내일 오후 3시 치과"',
          );
        }
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, uid, addChat]);

  /** 확인/추가입력 처리 */
  const handleFollowUp = useCallback(
    async (text: string) => {
      if (!uid || !pendingParse) return;
      addChat('user', text);

      const trimmed = text.trim().toLowerCase();

      // "네" 확인 → 저장
      if (
        (trimmed === '네' || trimmed === 'yes' || trimmed === 'ㅇ' || trimmed === '응') &&
        pendingParse.startAtISO
      ) {
        setIsProcessing(true);
        try {
          const canSchedule = await canScheduleMore();
          if (!canSchedule) {
            addChat('assistant', '⚠️ 하루 알림 제한(8개)에 도달했습니다. 기존 알림을 정리해 주세요.');
            return;
          }

          const startDate = new Date(pendingParse.startAtISO);
          let notificationId: string | null = null;

          try {
            notificationId = await scheduleNotification(
              pendingParse.titleCandidate || '일정 알림',
              `${dayjs(startDate).format('M월 D일 HH:mm')} 일정이 있습니다.`,
              startDate,
              { route: '/(tabs)' },
            );
          } catch {
            // 과거 시각 등의 이유로 알림 실패해도 저장은 진행
          }

          await createMutation.mutateAsync({
            userId: uid,
            title: pendingParse.titleCandidate || text,
            startAt: startDate,
            repeatType: pendingParse.repeatType,
            notificationEnabled: !!notificationId,
            notificationId,
            sourceText: text,
          });

          addChat('assistant', '✅ 일정이 저장되었습니다!');
          setPendingParse(null);
          showToast('일정 저장 완료');
        } catch (error) {
          showError(error, '일정 저장에 실패했습니다.');
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // "아니오" → 취소
      if (trimmed === '아니오' || trimmed === 'no' || trimmed === 'ㄴ') {
        addChat('assistant', '취소했습니다. 다시 입력해 주세요.');
        setPendingParse(null);
        return;
      }

      // 추가 정보 입력 → 재파싱 후 병합
      const tz = getUserTimezone();
      const parsed = localParse(text, tz);
      const merged: ParseResult = {
        titleCandidate: parsed.titleCandidate || pendingParse.titleCandidate,
        startAtISO: parsed.startAtISO || pendingParse.startAtISO,
        repeatType: parsed.repeatType !== 'none' ? parsed.repeatType : pendingParse.repeatType,
        missingFields: [],
      };

      // 여전히 날짜가 없으면 재질문
      if (!merged.startAtISO) {
        addChat('assistant', '날짜를 아직 파악하지 못했어요. 예) "3월 15일 오후 2시"');
        return;
      }

      setPendingParse(merged);
      const title = merged.titleCandidate || text;
      const dateStr = dayjs(merged.startAtISO).format('M월 D일 (ddd) HH:mm');
      addChat('assistant', `📌 "${title}"\n📆 ${dateStr}\n\n이대로 저장할까요? (네/아니오)`, merged);
    },
    [uid, pendingParse, addChat, createMutation],
  );

  /** 텍스트 전송 핸들러 */
  const onSubmit = useCallback(() => {
    if (pendingParse) {
      handleFollowUp(inputText.trim());
      setInputText('');
    } else {
      handleSend();
    }
  }, [pendingParse, inputText, handleSend, handleFollowUp]);

  if (isLoading) return <Loading />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <View>
              {/* 채팅 영역 */}
              {chatMessages.length > 0 && (
                <View style={styles.chatSection}>
                  {chatMessages.map((msg) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.chatBubble,
                        msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chatText,
                          msg.role === 'user' ? styles.userText : styles.assistantText,
                        ]}
                      >
                        {msg.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 오늘 일정 */}
              <Text style={styles.sectionTitle}>📌 오늘 일정</Text>
              {todaySchedules.length === 0 ? (
                <EmptyState message="오늘 일정이 없습니다." />
              ) : (
                todaySchedules.map((s) => <ScheduleItem key={s.id} schedule={s} />)
              )}

              {/* 다가오는 일정 */}
              <Text style={styles.sectionTitle}>📆 다가오는 일정</Text>
              {upcomingSchedules.length === 0 ? (
                <EmptyState message="예정된 일정이 없습니다." />
              ) : (
                upcomingSchedules.map((s) => <ScheduleItem key={s.id} schedule={s} />)
              )}
            </View>
          }
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
        />

        {/* 입력 영역 */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="자연어로 일정 입력 (예: 내일 오후 3시 회의)"
            placeholderTextColor="#BBB"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            editable={!isProcessing}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isProcessing) && styles.sendBtnDisabled]}
            onPress={onSubmit}
            disabled={!inputText.trim() || isProcessing}
          >
            <Text style={styles.sendBtnText}>{isProcessing ? '...' : '전송'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  flex: { flex: 1 },
  listContent: { paddingBottom: 12, paddingTop: 8 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  },

  chatSection: { paddingHorizontal: 16, paddingBottom: 8 },
  chatBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 3,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A90D9',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD',
  },
  chatText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFF' },
  assistantText: { color: '#333' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    height: 42,
    fontSize: 14,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: '#333',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#4A90D9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: '#CCC' },
  sendBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
