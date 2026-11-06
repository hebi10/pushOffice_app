/**
 * 채팅 내역 화면 – 카카오톡 스타일 채팅 히스토리
 *
 * AI와 대화한 일정 등록 이력을 표시하고,
 * 각 일정 메시지에서 취소/수정이 가능하다.
 */
import { Loading } from '@/src/components/Loading';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { AssistantButton } from '@/src/components/AssistantUI';
import { APP_FONT_FAMILY } from '@/src/lib/typography';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
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
  const { data: messages, isLoading, isError, refetch } = useChatHistory();
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
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.divider }]}
                  accessibilityRole="button"
                  accessibilityLabel="일정 수정"
                  accessibilityHint={msg.text}
                  onPress={() => handleEdit(msg)}
                >
                  <Ionicons name="create-outline" size={13} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.divider }]}
                  accessibilityRole="button"
                  accessibilityLabel="일정 취소"
                  accessibilityHint={msg.text}
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

  if (isError && !messages?.length) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
        <View style={styles.pageHeading}>
          <ScreenIntro eyebrow="지난 일정 기록" title="채팅 내역" description="일정 등록·변경 내역을 확인하세요." compact />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>채팅 내역을 불러오지 못했습니다</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>연결 상태를 확인한 뒤 다시 시도해 주세요.</Text>
          <View style={styles.emptyAction}>
            <AssistantButton label="다시 불러오기" icon="refresh-outline" onPress={() => refetch()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <View style={styles.pageHeading}>
        <ScreenIntro
          eyebrow="지난 일정 기록"
          title="채팅 내역"
          description="일정 등록·변경 내역을 확인하세요."
          compact
        />
      </View>
      {(!messages || messages.length === 0) ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            아직 채팅 내역이 없습니다
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
            기록된 일정 대화가 생기면{'\n'}이곳에서 확인할 수 있습니다.
          </Text>
          <View style={styles.emptyAction}>
            <AssistantButton
              label="홈으로 이동"
              icon="home-outline"
              onPress={() => router.push('/(tabs)')}
            />
          </View>
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
  pageHeading: { paddingHorizontal: uiSizes.screenGutter, paddingTop: uiSpacing.sm },
  listContent: { paddingVertical: uiSpacing.xs, paddingHorizontal: uiSizes.screenGutter, paddingBottom: uiSpacing.xxl },

  /* 날짜 구분선 */
  dateSepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: uiSpacing.sm,
    paddingHorizontal: uiSpacing.xxs,
  },
  dateSepLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateSepText: {
    ...uiTypography.caption,
    paddingHorizontal: uiSpacing.xs + 2,
    fontWeight: '500',
  },

  /* 말풍선 */
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 3,
    gap: uiSpacing.xxs + 2,
  },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: uiRadii.button,
    paddingHorizontal: uiSpacing.sm + 2,
    paddingVertical: uiSpacing.xs + 2,
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
  bubbleText: { ...uiTypography.body, fontSize: 14, lineHeight: 21 },
  cancelledText: {
    textDecorationLine: 'line-through',
  },
  timeText: { ...uiTypography.caption, fontSize: 11, marginBottom: uiSpacing.xxs },

  /* 액션 버튼 */
  actionRow: {
    flexDirection: 'row',
    marginTop: uiSpacing.xs + 2,
    gap: uiSpacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiSpacing.xxs,
    minHeight: uiSizes.touchMinHeight,
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.field,
    paddingHorizontal: uiSpacing.xs,
    paddingVertical: uiSpacing.xs,
  },
  actionText: {
    ...uiTypography.caption,
    fontWeight: '600',
  },

  /* 빈 상태 */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: uiSpacing.xl,
  },
  emptyTitle: { ...uiTypography.sectionTitle, fontSize: 16, fontWeight: '600', marginTop: uiSpacing.sm, textAlign: 'center' },
  emptyHint: { ...uiTypography.body, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: uiSpacing.xs },
  emptyAction: { width: '100%', maxWidth: 320, marginTop: uiSpacing.lg },
});
