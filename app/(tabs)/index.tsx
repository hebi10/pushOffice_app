/**
 * Home 화면 – 자연어 일정 등록 (선택지 기반) + 오늘/다가오는 일정
 */
import { EmptyState } from '@/src/components/EmptyState';
import { Loading } from '@/src/components/Loading';
import { ScheduleItem } from '@/src/components/ScheduleItem';
import { showError, showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useSaveChatMessages } from '@/src/features/chat';
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
import type { ChatMessage, ParseResult, SchedulePreviewItem, ScheduleType } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** 모호한 입력 시 표시할 선택지 */
interface ChoiceOption {
  id: number;
  label: string;
  action: 'today' | 'pickDate' | 'repeat' | 'reminder' | 'retry';
}

const CHOICE_OPTIONS: ChoiceOption[] = [
  { id: 1, label: '오늘 일정으로 등록', action: 'today' },
  { id: 2, label: '날짜를 직접 지정', action: 'pickDate' },
  { id: 3, label: '반복 일정으로 등록', action: 'repeat' },
  { id: 4, label: '알림만 설정', action: 'reminder' },
  { id: 5, label: '다시 입력하기', action: 'retry' },
];

export default function HomeScreen() {
  const uid = useAppSelector((s) => s.auth.uid);
  const { data: schedules, isLoading } = useSchedules();
  const createMutation = useCreateSchedule();
  const saveChatMutation = useSaveChatMessages();
  const { colors } = useTheme();

  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingParse, setPendingParse] = useState<ParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [ambiguousText, setAmbiguousText] = useState('');
  const [previewItems, setPreviewItems] = useState<SchedulePreviewItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  // mutate 함수를 ref로 저장해 effect dependency에서 제외
  const saveChatMutateRef = useRef(saveChatMutation.mutate);
  useEffect(() => { saveChatMutateRef.current = saveChatMutation.mutate; });

  // 앱 진입 시 반복 일정 재스케줄
  useEffect(() => {
    if (uid) {
      rescheduleOverdueRepeating(uid).catch(console.error);
      requestNotificationPermission().catch(console.error);
    }
  }, [uid]);

  // 채팅 메시지 변경 시 저장 (ref를 통해 무한루프 방지)
  useEffect(() => {
    if (chatMessages.length > 0) {
      saveChatMutateRef.current(chatMessages);
    }
  }, [chatMessages]);

  // 오늘 + 다가오는 일정 필터
  const todayStart = dayjs().startOf('day');
  const todayEnd = dayjs().endOf('day');

  const todaySchedules = useMemo(
    () =>
      (schedules ?? []).filter((s) => {
        const d = dayjs(s.startAt?.toDate?.());
        return d.isAfter(todayStart) && d.isBefore(todayEnd);
      }),
    [schedules, todayStart, todayEnd],
  );

  const upcomingSchedules = useMemo(
    () =>
      (schedules ?? [])
        .filter((s) => {
          const d = dayjs(s.startAt?.toDate?.());
          return d.isAfter(todayEnd);
        })
        .slice(0, 10),
    [schedules, todayEnd],
  );

  const addChat = useCallback(
    (role: ChatMessage['role'], text: string, scheduleData?: Partial<ParseResult>, scheduleId?: string) => {
      const msg: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(),
        role,
        text,
        timestamp: Date.now(),
        scheduleData,
        scheduleId,
      };
      setChatMessages((prev) => [...prev, msg]);
    },
    [],
  );

  /** 일정 저장 공통 함수 – scheduleId 반환 */
  const saveSchedule = useCallback(
    async (
      title: string,
      startDate: Date,
      repeatType: ParseResult['repeatType'],
      sourceText: string,
      type: ScheduleType = 'schedule',
    ): Promise<string | null> => {
      if (!uid) return null;

      const canSch = await canScheduleMore();
      if (!canSch) {
        addChat('assistant', '하루 알림 제한(8개)에 도달했습니다. 기존 알림을 정리한 뒤 다시 시도해 주세요.');
        return null;
      }

      let notificationId: string | null = null;
      if (startDate > new Date()) {
        try {
          notificationId = await scheduleNotification(
            title,
            `${dayjs(startDate).format('M월 D일 HH:mm')} 일정이 있습니다.`,
            startDate,
            { route: '/(tabs)' },
          );
        } catch {
          // 과거 시각 등은 무시
        }
      }

      const scheduleId = await createMutation.mutateAsync({
        userId: uid,
        type,
        title,
        startAt: startDate,
        repeatType,
        notificationEnabled: !!notificationId,
        notificationId,
        sourceText,
      });

      addChat(
        'assistant',
        `"${title}" 일정이 등록되었습니다.\n${dayjs(startDate).format('M월 D일 (ddd) HH:mm')}`,
        undefined,
        scheduleId,
      );
      showToast('일정 저장 완료');
      return scheduleId;
    },
    [uid, createMutation, addChat],
  );

  /** 다중 일정 감지: 콤마 구분 ("10일 회의, 12일 병원, 15일 여행") */
  const detectMultiSchedule = useCallback(
    (text: string, tz: string): SchedulePreviewItem[] | null => {
      const segments = text
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length < 2) return null;

      const items: SchedulePreviewItem[] = [];
      for (const seg of segments) {
        const parsed = localParse(seg, tz);
        if (parsed.startAtISO) {
          items.push({
            title: parsed.titleCandidate || seg,
            startAtISO: parsed.startAtISO,
            endAtISO: null,
            isAllDay: false,
            repeatType: parsed.repeatType,
            selected: true,
          });
        }
      }
      return items.length >= 2 ? items : null;
    },
    [],
  );

  /** 다중 일정 일괄 등록 */
  const handleBatchSave = useCallback(async () => {
    const selected = previewItems.filter((p) => p.selected);
    if (selected.length === 0) {
      setShowPreview(false);
      return;
    }

    setIsProcessing(true);
    try {
      let savedCount = 0;
      for (const item of selected) {
        const result = await saveSchedule(
          item.title,
          new Date(item.startAtISO),
          item.repeatType,
          item.title,
        );
        if (result) savedCount++;
      }
      if (savedCount > 0) {
        addChat('assistant', `총 ${savedCount}건의 일정이 일괄 등록되었습니다.`);
      }
    } catch (error) {
      showError(error, '일괄 등록에 실패했습니다.');
    } finally {
      setIsProcessing(false);
      setShowPreview(false);
      setPreviewItems([]);
    }
  }, [previewItems, saveSchedule, addChat]);

  /** 이미지 선택 → OCR (준비 중) */
  const handleImagePick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      addChat('user', '[이미지 업로드]');
      // TODO: OCR 엔드포인트 연동 후 일정 인식 결과를 previewItems로 표시
      addChat(
        'assistant',
        '이미지 인식 기능은 준비 중입니다.\n텍스트로 일정을 입력해 주세요.\n예: "10일 회의, 12일 병원, 15일 여행"',
      );
    }
  }, [addChat]);

  /** 전송 처리 */
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !uid) return;
    const text = inputText.trim();
    setInputText('');
    addChat('user', text);
    setIsProcessing(true);

    try {
      const tz = getUserTimezone();

      // ── 다중 일정 감지 ──
      const multiItems = detectMultiSchedule(text, tz);
      if (multiItems) {
        setPreviewItems(multiItems);
        setShowPreview(true);
        addChat(
          'assistant',
          `${multiItems.length}건의 일정이 감지되었습니다. 확인 후 등록해 주세요.`,
        );
        setIsProcessing(false);
        return;
      }

      const result = localParse(text, tz);

      // 완전 파싱 성공 → 즉시 저장 확인
      if (result.missingFields.length === 0 && result.startAtISO) {
        setPendingParse(result);
        const title = result.titleCandidate || text;
        const dateStr = dayjs(result.startAtISO).format('M월 D일 (ddd) HH:mm');
        const repeatLabel =
          result.repeatType === 'none'
            ? ''
            : ` (${result.repeatType === 'monthly' ? '매월' : '매년'} 반복)`;
        addChat(
          'assistant',
          `"${title}"\n${dateStr}${repeatLabel}\n\n이대로 저장할까요?`,
          result,
        );
      } else if (result.startAtISO && result.missingFields.length <= 1) {
        // 부분 파싱 → 누락 필드 질문
        setPendingParse(result);
        const questions = result.missingFields.map((f) => {
          if (f === 'title') return '일정 제목을 알려주세요.';
          if (f === 'time') return '시간을 알려주세요. (기본: 오전 9시)';
          return `${f} 정보를 알려주세요.`;
        });
        addChat('assistant', questions.join('\n'));
      } else {
        // AI 파싱 시도
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
            addChat('assistant', `"${aiResult.title}"\n${dateStr}\n\n이대로 저장할까요?`, parsed);
          } else {
            // AI도 실패 → 선택지 모달
            setAmbiguousText(text);
            setShowChoices(true);
            addChat('assistant', '아래에서 원하는 작업을 선택해 주세요.');
          }
        } catch {
          // AI 호출 실패 → 선택지 모달
          setAmbiguousText(text);
          setShowChoices(true);
          addChat('assistant', '어떤 작업을 원하시나요?');
        }
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, uid, addChat, detectMultiSchedule]);

  /** 선택지 처리 */
  const handleChoiceSelect = useCallback(
    async (option: ChoiceOption) => {
      setShowChoices(false);
      const text = ambiguousText;

      if (option.action === 'retry') {
        setInputText(text);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      if (option.action === 'today') {
        setIsProcessing(true);
        try {
          const title = text || '새 일정';
          const startDate = dayjs().hour(9).minute(0).second(0).toDate();
          await saveSchedule(title, startDate, 'none', text);
        } catch (error) {
          showError(error, '일정 저장에 실패했습니다.');
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (option.action === 'pickDate') {
        addChat('assistant', '날짜와 시간을 입력해 주세요.\n예: "3월 15일 오후 2시"');
        setPendingParse({
          titleCandidate: text,
          startAtISO: null,
          repeatType: 'none',
          missingFields: ['date', 'time'],
        });
        return;
      }

      if (option.action === 'repeat') {
        addChat('assistant', '반복 주기와 날짜를 알려주세요.\n예: "매월 15일 오전 10시"');
        setPendingParse({
          titleCandidate: text,
          startAtISO: null,
          repeatType: 'monthly',
          missingFields: ['date', 'time'],
        });
        return;
      }

      if (option.action === 'reminder') {
        setIsProcessing(true);
        try {
          const title = text || '알림';
          const startDate = dayjs().add(1, 'hour').startOf('minute').toDate();
          await saveSchedule(title, startDate, 'none', text, 'reminder');
        } catch (error) {
          showError(error, '알림 설정에 실패했습니다.');
        } finally {
          setIsProcessing(false);
        }
        return;
      }
    },
    [ambiguousText, addChat, saveSchedule],
  );

  /** 확인 / 추가 입력 처리 */
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
          await saveSchedule(
            pendingParse.titleCandidate || text,
            new Date(pendingParse.startAtISO),
            pendingParse.repeatType,
            text,
          );
          setPendingParse(null);
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

      if (!merged.startAtISO) {
        addChat('assistant', '날짜를 파악하지 못했어요.\n예: "3월 15일 오후 2시"');
        return;
      }

      setPendingParse(merged);
      const title = merged.titleCandidate || text;
      const dateStr = dayjs(merged.startAtISO).format('M월 D일 (ddd) HH:mm');
      addChat('assistant', `"${title}"\n${dateStr}\n\n이대로 저장할까요?`, merged);
    },
    [uid, pendingParse, addChat, saveSchedule],
  );

  /** 텍스트 전송 핸들러 */
  const onSubmit = useCallback(() => {
    if (!inputText.trim()) return;
    if (pendingParse) {
      handleFollowUp(inputText.trim());
      setInputText('');
    } else {
      handleSend();
    }
  }, [pendingParse, inputText, handleSend, handleFollowUp]);

  if (isLoading) return <Loading />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
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
                        msg.role === 'user'
                          ? [styles.userBubble, { backgroundColor: colors.chatUserBubble }]
                          : [
                              styles.assistantBubble,
                              {
                                backgroundColor: colors.chatAssistantBubble,
                                borderColor: colors.chatAssistantBorder,
                              },
                            ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.chatText,
                          msg.role === 'user'
                            ? { color: colors.chatUserText }
                            : { color: colors.chatAssistantText },
                        ]}
                      >
                        {msg.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 채팅이 없을 때 안내 */}
              {chatMessages.length === 0 && (
                <View style={styles.welcomeSection}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textTertiary} />
                  <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
                    자연어로 일정을 등록해 보세요
                  </Text>
                  <Text style={[styles.welcomeHint, { color: colors.textTertiary }]}>
                    예: "내일 오후 3시 팀 회의"
                  </Text>
                </View>
              )}

              {/* 오늘 일정 */}
              <View style={styles.sectionHeader}>
                <Ionicons name="today-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>오늘 일정</Text>
              </View>
              {todaySchedules.length === 0 ? (
                <EmptyState message="오늘 일정이 없습니다." />
              ) : (
                todaySchedules.map((s) => <ScheduleItem key={s.id} schedule={s} />)
              )}

              {/* 다가오는 일정 */}
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>다가오는 일정</Text>
              </View>
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
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
          <TouchableOpacity
            style={[styles.imageBtn, { borderColor: colors.inputBorder }]}
            onPress={handleImagePick}
            disabled={isProcessing}
          >
            <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="일정을 입력하세요 (예: 내일 오후 3시 회의)"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            editable={!isProcessing}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!inputText.trim() || isProcessing) && styles.sendBtnDisabled,
            ]}
            onPress={onSubmit}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <Ionicons name="hourglass-outline" size={18} color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 선택지 모달 */}
      <Modal visible={showChoices} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>어떤 작업을 원하시나요?</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              "{ambiguousText}"
            </Text>
            {CHOICE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.choiceBtn, { borderColor: colors.inputBorder }]}
                onPress={() => handleChoiceSelect(opt)}
              >
                <Text style={[styles.choiceNum, { color: colors.primary }]}>{opt.id}</Text>
                <Text style={[styles.choiceLabel, { color: colors.text }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.choiceCancelBtn}
              onPress={() => setShowChoices(false)}
            >
              <Text style={[styles.choiceCancelText, { color: colors.textTertiary }]}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 다중 일정 미리보기 모달 */}
      <Modal visible={showPreview} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>일정 미리보기</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              등록할 일정을 선택하세요
            </Text>
            <ScrollView style={styles.previewScroll}>
              {previewItems.map((item, idx) => (
                <View
                  key={`${item.startAtISO}-${idx}`}
                  style={[styles.previewRow, { borderColor: colors.inputBorder }]}
                >
                  <Switch
                    value={item.selected}
                    onValueChange={(val) => {
                      setPreviewItems((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, selected: val } : p)),
                      );
                    }}
                    trackColor={{ false: colors.divider, true: colors.primary }}
                  />
                  <View style={styles.previewInfo}>
                    <Text style={[styles.previewTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.previewDate, { color: colors.textSecondary }]}>
                      {dayjs(item.startAtISO).format('M월 D일 (ddd) HH:mm')}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.batchSaveBtn,
                { backgroundColor: colors.primary },
                isProcessing && styles.sendBtnDisabled,
              ]}
              onPress={handleBatchSave}
              disabled={isProcessing}
            >
              <Text style={styles.batchSaveBtnText}>
                {previewItems.filter((p) => p.selected).length}건 일괄 등록
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.choiceCancelBtn}
              onPress={() => {
                setShowPreview(false);
                setPreviewItems([]);
              }}
            >
              <Text style={[styles.choiceCancelText, { color: colors.textTertiary }]}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  listContent: { paddingBottom: 12, paddingTop: 8 },

  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  welcomeHint: {
    fontSize: 13,
    marginTop: 6,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },

  chatSection: { paddingHorizontal: 16, paddingBottom: 8 },
  chatBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 3,
  },
  userBubble: { alignSelf: 'flex-end' },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatText: { fontSize: 14, lineHeight: 20 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: 42,
    fontSize: 14,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  imageBtn: {
    width: 42,
    height: 42,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 6,
  },
  sendBtn: {
    marginLeft: 8,
    borderRadius: 20,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  /* 선택지 모달 */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  choiceNum: {
    fontSize: 15,
    fontWeight: '700',
    width: 24,
  },
  choiceLabel: {
    fontSize: 15,
    flex: 1,
  },
  choiceCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  choiceCancelText: {
    fontSize: 14,
  },

  /* 다중 일정 미리보기 */
  previewScroll: {
    maxHeight: 300,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewDate: {
    fontSize: 13,
    marginTop: 2,
  },
  batchSaveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  batchSaveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
