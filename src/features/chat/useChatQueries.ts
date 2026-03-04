/**
 * 채팅 히스토리 React Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '../../store/store';
import type { ChatMessage } from '../../types';
import {
    fbGetChatHistory,
    fbSaveChatMessages,
    fbUpdateChatMessage,
    localGetChatHistory,
    localSaveChatMessages,
    localUpdateChatMessage,
} from './chatService';

const QUERY_KEY = 'chatHistory';

/** 채팅 내역 조회 */
export function useChatHistory() {
  const uid = useAppSelector((s) => s.auth.uid);
  const mode = useAppSelector((s) => s.storageMode.mode);

  return useQuery<ChatMessage[]>({
    queryKey: [QUERY_KEY, uid, mode],
    queryFn: async () => {
      if (mode === 'local') {
        return localGetChatHistory();
      }
      if (!uid) return [];
      const docs = await fbGetChatHistory(uid);
      return docs[0]?.messages ?? [];
    },
    enabled: mode === 'local' || !!uid,
    // 탭 전환 시 항상 최신 데이터 표시
    staleTime: 0,
    // 앱이 포그라운드로 돌아올 때 자동 refetch
    refetchOnWindowFocus: true,
  });
}

/** 채팅 메시지 저장 */
export function useSaveChatMessages() {
  const uid = useAppSelector((s) => s.auth.uid);
  const mode = useAppSelector((s) => s.storageMode.mode);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messages: ChatMessage[]) => {
      if (mode === 'local') {
        await localSaveChatMessages(messages);
      } else if (uid) {
        await fbSaveChatMessages(uid, messages);
      }
      return messages;
    },
    onSuccess: (messages) => {
      // 캐시를 즉시 업데이트해 채팅내역 탭이 바로 반영되도록
      queryClient.setQueryData([QUERY_KEY, uid, mode], messages);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** 단일 메시지 업데이트 (취소/수정 마킹) */
export function useUpdateChatMessage() {
  const uid = useAppSelector((s) => s.auth.uid);
  const mode = useAppSelector((s) => s.storageMode.mode);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      patch,
    }: {
      messageId: string;
      patch: Partial<ChatMessage>;
    }) => {
      if (mode === 'local') {
        await localUpdateChatMessage(messageId, patch);
      } else if (uid) {
        await fbUpdateChatMessage(uid, messageId, patch);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
