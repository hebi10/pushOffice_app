import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { useFocusEffect } from 'expo-router';
import { AssistantButton, AssistantCard, AssistantTextField, SettingRow, assistantStyles as s } from '@/src/components/AssistantUI';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAppSelector } from '@/src/store/store';
import { saveAssistantSettings } from '@/src/features/storage/nativeSettings';
import { requestNotificationPermission } from '@/src/features/notifications/permission';
import { reminderCapabilities } from '@/src/features/notifications/useNativeAssistant';
import { PushOfficeNative, type ReminderCapabilities } from '@/modules/push-office-native';
import { showError } from '@/src/components/ui/toast';
import { getLegacyCloudState } from '@/src/features/storage/storageMode';
import { retryLegacyRecovery } from '@/src/features/storage/legacyRecovery';
import { subscribeOnActive, type LegacyCloudState } from '@/src/features/storage/recoveryPolicy';
import type { UserSettings } from '@/src/types';
export default function SettingsScreen() {
    const { colors, isDark } = useTheme();
    const settings = useAppSelector(x => x.settings);
    const [cap, setCap] = useState<ReminderCapabilities | null>(null);
    const [legacy, setLegacy] = useState<LegacyCloudState | null>(null);
    const [recovering, setRecovering] = useState(false);
    const [ai, setAi] = useState('기기 지원 상태를 확인하고 있습니다.');
    const [section, setSection] = useState<'basic' | 'advanced'>('basic');
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
    const [hour, setHour] = useState(String(settings.dailyBriefingTime.hour).padStart(2, '0'));
    const [minute, setMinute] = useState(String(settings.dailyBriefingTime.minute).padStart(2, '0'));
    const [city, setCity] = useState(settings.digestCity);
    const [keywords, setKeywords] = useState(settings.newsKeywords.join(', '));
    const [tickers, setTickers] = useState(settings.stockTickers.join(', '));
    const [language, setLanguage] = useState(settings.newsLanguage);
    useEffect(() => { setHour(String(settings.dailyBriefingTime.hour).padStart(2, '0')); setMinute(String(settings.dailyBriefingTime.minute).padStart(2, '0')); }, [settings.dailyBriefingTime.hour, settings.dailyBriefingTime.minute]);
    const refresh = useCallback(() => { void getLegacyCloudState().then(setLegacy).catch(console.warn); reminderCapabilities().then(setCap).catch(() => setCap(null)); PushOfficeNative.getAiStatus().then(x => setAi(x.message)).catch(() => setAi('로컬 AI 지원 Android 빌드가 필요합니다.')); }, []);
    useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
    useEffect(() => subscribeOnActive(AppState, refresh), [refresh]);
    const retryImport = async () => { setRecovering(true); try { setLegacy(await retryLegacyRecovery()); } catch (error) { showError(error, '이전 일정 원본을 보존하고 있어요. 다시 시도해 주세요.'); } finally { setRecovering(false); } };
    const save = async (patch: Partial<UserSettings>) => { try {
        await saveAssistantSettings(patch);
    }
    catch (e) {
        showError(e, '설정을 저장하지 못했어요.');
    } };
    const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
        <SettingRow title={label} value={value} onValueChange={onChange} />
    );
    const input = (
        label: string,
        value: string,
        onChangeText: (next: string) => void,
        keyboardType: 'default' | 'number-pad' = 'default',
    ) => (
        <AssistantTextField
            label={label}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
        />
    );
    const permission = async () => { await requestNotificationPermission(); refresh(); };
    const addTile = async () => { try {
        const status = await PushOfficeNative.requestAddTile();
        const labels: Record<string, string> = { added: '빠른 설정에 타일을 추가했어요.', already_added: '이미 빠른 설정에 추가되어 있어요.', not_added: '추가하지 않았어요. 빠른 설정 편집에서도 직접 배치할 수 있어요.', unsupported_manual: '이 Android 버전에서는 빠른 설정 편집에서 Push Office를 직접 추가해 주세요.' };
        setNotice({ title: '빠른 설정 타일', message: labels[status] ?? `시스템 응답: ${status}` });
    }
    catch (e) {
        showError(e, '타일 추가 요청을 열 수 없습니다.');
    } };
    const pin = async (kind: 'small' | 'agenda') => { try {
        const accepted = await PushOfficeNative.requestPinWidget(kind);
        setNotice({ title: '홈 화면 위젯', message: accepted ? '런처에 추가 요청을 전달했습니다. 표시된 확인 창에서 추가를 완료해 주세요.' : '이 런처는 위젯 추가 요청을 지원하지 않습니다. 홈 화면을 길게 누른 뒤 위젯에서 Push Office를 선택해 주세요.' });
    }
    catch (e) {
        showError(e, '위젯 추가 요청을 열 수 없습니다.');
    } };
    return (
      <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenIntro
          eyebrow="나에게 맞는 일정 비서"
          title="내 일정, 내 방식으로"
          description="자주 사용하는 기능부터 차근차근 설정하세요."
          artwork={require('@/assets/images/illustration-settings.jpg')}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['basic', '기본 설정'], ['advanced', '고급 설정']] as const).map(([value, label]) => {
            const active = section === value;
            return (
              <TouchableOpacity
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                onPress={() => setSection(value)}
                style={{
                  flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1,
                  borderColor: active ? colors.primary : colors.inputBorder,
                  backgroundColor: active ? colors.primary : colors.surface,
                  justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: active ? (isDark ? colors.background : '#FFFFFF') : colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {section === 'basic' ? (
          <>
            <AssistantCard title="알림과 아침 브리핑" icon="notifications-outline">
              {toggle('전체 일정 알림', settings.pushEnabled, v => { void save({ pushEnabled: v }); })}
              {toggle('매일 아침 브리핑', settings.dailyBriefingEnabled, v => { void save({ dailyBriefingEnabled: v }); })}
              <Text style={[s.caption, { color: colors.textSecondary }]}>아침 브리핑 알림 시간</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>{input('시 (0–23)', hour, setHour, 'number-pad')}</View>
                <View style={{ flex: 1 }}>{input('분 (0–59)', minute, setMinute, 'number-pad')}</View>
              </View>
              <AssistantButton label="브리핑 시간 저장" icon="time-outline" secondary onPress={() => {
                const h = Number(hour), m = Number(minute);
                if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) {
                  setNotice({ title: '시간 확인', message: '0–23시, 0–59분으로 입력해 주세요.' });
                  return;
                }
                void save({ dailyBriefingTime: { hour: h, minute: m } });
              }} />
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                알림 권한: {cap ? (cap.notificationsAllowed ? '허용됨' : '허용 필요') : '확인 중'}
                {'\n'}예약 방식: {cap?.timing === 'exact' ? '정확한 알람' : cap ? '일반 알람(절전 시 지연 가능)' : '확인 중'}
              </Text>
              <AssistantButton label="알림 권한 확인 및 요청" icon="notifications-outline" secondary onPress={() => { void permission(); }} />
              <AssistantButton label="시스템 앱 설정 열기" icon="settings-outline" secondary onPress={() => { void Linking.openSettings(); }} />
            </AssistantCard>
            <AssistantCard title="빠른 설정과 홈 위젯" icon="grid-outline">
              <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                빠른 설정 타일 또는 홈 위젯에서 바로 일정을 입력할 수 있습니다.
              </Text>
              <AssistantButton label="빠른 설정 타일 추가" icon="add-circle-outline" onPress={() => { void addTile(); }} />
              <AssistantButton label="다음 일정 위젯 추가" icon="calendar-outline" secondary onPress={() => { void pin('small'); }} />
              <AssistantButton label="오늘 일정 위젯 추가" icon="list-outline" secondary onPress={() => { void pin('agenda'); }} />
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                시스템 확인 창에서 추가를 완료해 주세요. 홈 화면을 길게 눌러 위젯을 선택할 수도 있습니다.
              </Text>
            </AssistantCard>
            <AssistantCard title="기기 내 음성과 AI" icon="mic-outline">
              <Text style={[s.body, { color: colors.text, fontWeight: '600' }]}>Gemini Nano</Text>
              <Text style={[s.subtitle, { color: colors.textSecondary }]}>{ai}</Text>
              <AssistantButton
                label="텍스트 · 음성 입력 열기"
                icon="mic-outline"
                secondary
                onPress={() => PushOfficeNative.openQuickEntry().catch(e => showError(e, '입력 창을 열 수 없습니다.'))}
              />
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                음성은 버튼을 누를 때 시작합니다. 지원 기기에서만 기기 내 한국어 인식과 AI 기능을 사용할 수 있습니다.
              </Text>
            </AssistantCard>
          </>
        ) : (
          <>
            <AssistantCard title="선택한 외부 정보" icon="cloud-outline">
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                홈에서 직접 불러올 때만 선택한 항목을 외부 서비스에 요청합니다. 일정 내용은 보내지 않습니다.
              </Text>
              {toggle('날씨', settings.digestTypes.weather, v => { void save({ digestTypes: { ...settings.digestTypes, weather: v } }); })}
              {input('날씨 도시', city, setCity)}
              {toggle('뉴스', settings.digestTypes.news, v => { void save({ digestTypes: { ...settings.digestTypes, news: v } }); })}
              {input('뉴스 키워드 (쉼표 구분)', keywords, setKeywords)}
              {input('뉴스 언어', language, setLanguage)}
              {toggle('주식', settings.digestTypes.stocks, v => { void save({ digestTypes: { ...settings.digestTypes, stocks: v } }); })}
              {input('주식 종목 (쉼표 구분, 최대 5개)', tickers, setTickers)}
              <AssistantButton label="외부 정보 설정 저장" icon="checkmark-outline" secondary onPress={() => {
                void save({
                  digestCity: city.trim(),
                  newsKeywords: keywords.split(',').map(x => x.trim()).filter(Boolean),
                  newsLanguage: language.trim(),
                  stockTickers: tickers.split(',').map(x => x.trim()).filter(Boolean).slice(0, 5),
                });
              }} />
            </AssistantCard>
            <AssistantCard title="이전 일정 가져오기" icon="cloud-download-outline">
              <Text style={[s.body, { color: colors.text }]}>{legacy?.message ?? '이전에 사용하던 Firebase 계정이 있다면 로컬로 가져올 수 있습니다.'}</Text>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                기존 원본은 수정하거나 삭제하지 않습니다. 가져오기 실패 시 다시 시도할 수 있습니다.
              </Text>
              <AssistantButton label="Firebase 일정 가져오기 다시 시도" icon="refresh-outline" secondary busy={recovering} onPress={() => { void retryImport(); }} />
            </AssistantCard>
            <AssistantCard title="화면과 보관" icon="color-palette-outline">
              <Text style={[s.caption, { color: colors.textSecondary }]}>화면 테마</Text>
              {([['system', '시스템 테마'], ['light', '밝은 테마'], ['dark', '어두운 테마']] as const).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: settings.themeMode === value }}
                  onPress={() => { void save({ themeMode: value }); }}
                  style={[s.row, { minHeight: 46 }]}
                >
                  <Text style={[s.body, { color: colors.text, flex: 1 }]}>{label}</Text>
                  <Text style={{ color: settings.themeMode === value ? colors.primary : colors.textTertiary, fontSize: 18 }}>
                    {settings.themeMode === value ? '◉' : '○'}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                일정은 이 기기에 저장됩니다. 앱 삭제 시 로컬 데이터도 삭제되며 Android 자동 백업은 사용하지 않습니다.
              </Text>
            </AssistantCard>
            <AssistantCard title="개인정보와 지원" icon="shield-checkmark-outline">
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                기기 AI 준비 상태 확인 시 ML Kit가 식별자와 진단 정보를 처리할 수 있습니다. 개인정보처리방침에서 자세히 확인하세요.
              </Text>
              <AssistantButton label="개인정보처리방침" icon="document-text-outline" secondary onPress={() => {
                void Linking.openURL('https://hebi10.github.io/pushOffice_app/privacy/').catch(e => showError(e, '개인정보처리방침을 열 수 없습니다.'));
              }} />
              <AssistantButton label="지원 문의" icon="mail-outline" secondary onPress={() => {
                void Linking.openURL('mailto:asdlkj0104@gmail.com').catch(e => showError(e, '메일 앱을 열 수 없습니다.'));
              }} />
            </AssistantCard>
          </>
        )}
      </ScrollView>
      <AppDialog
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        showCancel={false}
        onDismiss={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
      />
      </>
    );
}
