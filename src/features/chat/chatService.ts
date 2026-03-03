/**
 * 채팅 히스토리 서비스 – Firestore / AsyncStorage 기반
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    setDoc,
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
  await setDoc(
    ref,
    {
      userId,
      messages,
      updatedAt: Date.now(),
      createdAt: Date.now(), // setDoc merge won't overwrite
    },
    { merge: true },
  );
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
