/**
 * 채팅 내역 화면 – 카카오톡 스타일 채팅 히스토리
 *
 * AI와 대화한 일정 등록 이력을 표시하고,
 * 각 일정 메시지에서 취소/수정이 가능하다.
 */
import { Loading } from '@/src/components/Loading';
import { confirmAction, showError, showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useChatHistory, useUpdateChatMessage } from '@/src/features/chat';
import { cancelNotification } from '@/src/features/notifications';
import { useDeleteSchedule } from '@/src/features/schedules';
import { dayjs } from '@/src/lib/time';
import type { ChatMessage } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** 날짜별 그룹 */
interface DateGroup {
  type: 'dateSep';
  date: string;
}

type ListItem = DateGroup | ChatMessage;

export default function ChatHistoryScreen() {
  const { colors } = useTheme();
  const { data: messages, isLoading, refetch } = useChatHistory();
  const deleteMutation = useDeleteSchedule();
  const updateChatMsg = useUpdateChatMessage();
  const flatListRef = useRef<FlatList>(null);

  // 탭 포커스 시마다 최신 채팅 내역 불러오기
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  /** 날짜 구분선 포함 데이터 */
  const listData = useMemo<ListItem[]>(() => {
    if (!messages || messages.length === 0) return [];
    const items: ListItem[] = [];
    let lastDate = '';

    for (const msg of messages) {
      const d = dayjs(msg.timestamp).format('YYYY년 M월 D일 (ddd)');
      if (d !== lastDate) {
        items.push({ type: 'dateSep', date: d });
        lastDate = d;
      }
      items.push(msg);
    }
    return items;
  }, [messages]);

  /** 일정 취소 */
  const handleCancel = useCallback(
    (msg: ChatMessage) => {
      if (!msg.scheduleId) return;
      confirmAction('일정 취소', '이 일정을 취소하시겠습니까?\n캘린더에서 삭제되고 알림도 제거됩니다.', async () => {
        try {
          // 알림 취소
          if (msg.scheduleData && (msg.scheduleData as any).notificationId) {
            try {
              await cancelNotification((msg.scheduleData as any).notificationId);
            } catch { /* ignore */ }
          }
          // 일정 삭제
          await deleteMutation.mutateAsync(msg.scheduleId!);
          // 채팅 메시지에 취소 표시
          await updateChatMsg.mutateAsync({
            messageId: msg.id,
            patch: { cancelled: true },
          });
          showToast('일정이 취소되었습니다.');
        } catch (error) {
          showError(error, '일정 취소에 실패했습니다.');
        }
      });
    },
    [deleteMutation, updateChatMsg],
  );

  /** 일정 수정 (상세 페이지로 이동) */
  const handleEdit = useCallback((msg: ChatMessage) => {
    if (!msg.scheduleId) return;
    router.push(`/schedule/${msg.scheduleId}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      // 날짜 구분선
      if ('type' in item && item.type === 'dateSep') {
        return (
          <View style={styles.dateSepContainer}>
            <View style={[styles.dateSepLine, { backgroundColor: colors.divider }]} />
            <Text style={[styles.dateSepText, { color: colors.textTertiary, backgroundColor: colors.background }]}>
              {item.date}
            </Text>
            <View style={[styles.dateSepLine, { backgroundColor: colors.divider }]} />
          </View>
        );
      }

      // 채팅 메시지
      const msg = item as ChatMessage;
      const isUser = msg.role === 'user';
      const time = dayjs(msg.timestamp).format('HH:mm');

      return (
        <View
          style={[
            styles.bubbleRow,
            isUser ? styles.bubbleRowRight : styles.bubbleRowLeft,
          ]}
        >
          {/* 타임스탬프 (사용자 왼쪽) */}
          {isUser && <Text style={[styles.timeText, { color: colors.textTertiary }]}>{time}</Text>}

          <View
            style={[
              styles.bubble,
              isUser
                ? [styles.userBubble, { backgroundColor: colors.chatUserBubble }]
                : [
                    styles.assistantBubble,
                    { backgroundColor: colors.chatAssistantBubble, borderColor: colors.chatAssistantBorder },
                  ],
              msg.cancelled && styles.cancelledBubble,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                { color: isUser ? colors.chatUserText : colors.chatAssistantText },
                msg.cancelled && styles.cancelledText,
              ]}
            >
              {msg.cancelled ? `[취소됨] ${msg.text}` : msg.text}
            </Text>

            {/* 일정 연결 메시지 액션 버튼 */}
            {msg.scheduleId && !msg.cancelled && msg.role === 'assistant' && (
              <View style={[styles.actionRow, { borderTopColor: colors.divider }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderRightColor: colors.divider }]}
                  onPress={() => handleEdit(msg)}
                >
                  <Ionicons name="create-outline" size={13} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleCancel(msg)}
                >
                  <Ionicons name="close-circle-outline" size={13} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>취소</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 타임스탬프 (어시스턴트 오른쪽) */}
          {!isUser && <Text style={[styles.timeText, { color: colors.textTertiary }]}>{time}</Text>}
        </View>
      );
    },
    [colors, handleCancel, handleEdit],
  );

  if (isLoading) return <Loading />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      {(!messages || messages.length === 0) ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            아직 채팅 내역이 없습니다
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
            홈 탭에서 AI와 대화하여 일정을 등록하면{'\n'}이곳에 이력이 표시됩니다.
          </Text>
          <TouchableOpacity
            style={[styles.goHomeBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)')}
          >
            <Ionicons name="home-outline" size={16} color="#FFF" />
            <Text style={styles.goHomeBtnText}>홈으로 이동</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            'type' in item && item.type === 'dateSep'
              ? `sep-${index}`
              : (item as ChatMessage).id
          }
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingVertical: 12, paddingHorizontal: 12 },

  /* 날짜 구분선 */
  dateSepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  dateSepLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateSepText: {
    fontSize: 12,
    paddingHorizontal: 10,
    fontWeight: '500',
  },

  /* 말풍선 */
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 3,
    gap: 6,
  },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelledBubble: { opacity: 0.5 },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  cancelledText: {
    textDecorationLine: 'line-through',
  },
  timeText: {
    fontSize: 10,
    marginBottom: 2,
  },

  /* 액션 버튼 */
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* 빈 상태 */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  goHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  goHomeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
