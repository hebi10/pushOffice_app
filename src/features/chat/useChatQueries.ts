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
    },
    onSuccess: () => {
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
