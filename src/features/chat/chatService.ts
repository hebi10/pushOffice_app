/**
 * 채팅 히스토리 서비스 – Firestore / AsyncStorage 기반
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { ChatHistoryDoc, ChatMessage } from '../../types';

const COLLECTION = 'chatHistory';
const LOCAL_KEY = '@pushoffice/chatHistory';

// ══════════ Firebase ══════════

export async function fbGetChatHistory(userId: string): Promise<ChatHistoryDoc[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatHistoryDoc));
}

export async function fbSaveChatMessages(
  userId: string,
  messages: ChatMessage[],
): Promise<void> {
  const ref = doc(db, COLLECTION, userId);
  // 문서가 없을 때는 createdAt 포함 생성, 있을 때는 messages/updatedAt만 갱신
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      userId,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } else {
    await updateDoc(ref, {
      messages,
      updatedAt: Date.now(),
    });
  }
}

export async function fbUpdateChatMessage(
  userId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
): Promise<void> {
  const docs = await fbGetChatHistory(userId);
  const chatDoc = docs[0];
  if (!chatDoc) return;
  const msgs = chatDoc.messages.map((m) =>
    m.id === messageId ? { ...m, ...patch } : m,
  );
  await fbSaveChatMessages(userId, msgs);
}

// ══════════ Local ══════════

export async function localGetChatHistory(): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function localSaveChatMessages(
  messages: ChatMessage[],
): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(messages));
}

export async function localUpdateChatMessage(
  messageId: string,
  patch: Partial<ChatMessage>,
): Promise<void> {
  const msgs = await localGetChatHistory();
  const updated = msgs.map((m) =>
    m.id === messageId ? { ...m, ...patch } : m,
  );
  await localSaveChatMessages(updated);
}
