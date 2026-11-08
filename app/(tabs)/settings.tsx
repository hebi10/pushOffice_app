import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { useFocusEffect } from 'expo-router';
import { AssistantButton, AssistantTextField, assistantStyles as s } from '@/src/components/AssistantUI';
import { SettingsActionRow, SettingsChoiceRow, SettingsGroup, SettingsNote, SettingsStatusRow, SettingsToggleRow } from '@/src/components/settings/SettingsUI';
import { uiRadii, uiSizes, uiSpacing } from '@/src/lib/designTokens';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAppSelector } from '@/src/store/store';
import { saveAssistantSettings } from '@/src/features/storage/nativeSettings';
import { requestNotificationPermission } from '@/src/features/notifications/permission';
import { reminderCapabilities } from '@/src/features/notifications/useNativeAssistant';
import { PushOfficeNative, type AiStatus, type AiDownloadProgress, type ReminderCapabilities } from '@/modules/push-office-native';
import { showError } from '@/src/components/ui/toast';
import { getLegacyCloudState } from '@/src/features/storage/storageMode';
import { retryLegacyRecovery } from '@/src/features/storage/legacyRecovery';
import { subscribeOnActive, type LegacyCloudState } from '@/src/features/storage/recoveryPolicy';
import type { UserSettings } from '@/src/types';
export default function SettingsScreen() {
    const { colors } = useTheme();
    const settings = useAppSelector(x => x.settings);
    const [cap, setCap] = useState<ReminderCapabilities | null>(null);
    const [legacy, setLegacy] = useState<LegacyCloudState | null>(null);
    const [recovering, setRecovering] = useState(false);
    const [ai, setAi] = useState<AiStatus>({ status: 'error', message: '기기 지원 상태를 확인하고 있습니다.' });
    const [aiDownloading, setAiDownloading] = useState(false);
    const [aiProgress, setAiProgress] = useState<AiDownloadProgress | null>(null);
    const [tileEnabled, setTileEnabled] = useState(true);
    const [section, setSection] = useState<'basic' | 'advanced'>('basic');
    const [editingTime, setEditingTime] = useState(false);
    const [editingExternal, setEditingExternal] = useState(false);
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [hour, setHour] = useState(String(settings.dailyBriefingTime.hour).padStart(2, '0'));
    const [minute, setMinute] = useState(String(settings.dailyBriefingTime.minute).padStart(2, '0'));
    const [city, setCity] = useState(settings.digestCity);
    const [keywords, setKeywords] = useState(settings.newsKeywords.join(', '));
    const [tickers, setTickers] = useState(settings.stockTickers.join(', '));
    const [language, setLanguage] = useState(settings.newsLanguage);
    useEffect(() => { setHour(String(settings.dailyBriefingTime.hour).padStart(2, '0')); setMinute(String(settings.dailyBriefingTime.minute).padStart(2, '0')); }, [settings.dailyBriefingTime.hour, settings.dailyBriefingTime.minute]);
    useEffect(() => setCity(settings.digestCity), [settings.digestCity]);
    useEffect(() => setKeywords(settings.newsKeywords.join(', ')), [settings.newsKeywords]);
    useEffect(() => setTickers(settings.stockTickers.join(', ')), [settings.stockTickers]);
    useEffect(() => setLanguage(settings.newsLanguage), [settings.newsLanguage]);
    const refresh = useCallback(() => { void getLegacyCloudState().then(setLegacy).catch(console.warn); reminderCapabilities().then(setCap).catch(() => setCap(null)); PushOfficeNative.getAiStatus().then(setAi).catch(() => setAi({ status: 'error', message: '로컬 AI 지원 Android 빌드가 필요합니다.' })); PushOfficeNative.getQuickTileEnabled().then(setTileEnabled).catch(() => setTileEnabled(false)); }, []);
    useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
    useEffect(() => subscribeOnActive(AppState, refresh), [refresh]);
    useEffect(() => {
        const listener = PushOfficeNative.addListener('aiDownloadProgress', setAiProgress);
        return () => listener.remove();
    }, []);
    const downloadAi = async () => {
      setAiDownloading(true);
      setAiProgress(null);
      try {
        const result = await PushOfficeNative.downloadAiModel();
        setAi(result);
        if (result.status === 'error') setNotice({ title: '기기 AI 다운로드', message: result.message });
      } catch (error) { showError(error, 'AI 모델 다운로드를 실행할 수 없습니다.'); }
      finally { setAiDownloading(false); }
    };
    const toggleTile = async (enabled: boolean) => {
      try {
        await PushOfficeNative.setQuickTileEnabled(enabled);
        setTileEnabled(enabled);
        if (enabled) setNotice({ title: '빠른 설정', message: '기능을 켰습니다. 아래 타일 추가에서 시스템 빠른 설정에 배치해 주세요.' });
      } catch (error) { showError(error, '빠른 설정 사용 여부를 변경하지 못했습니다.'); }
    };
    const retryImport = async () => { setRecovering(true); try { setLegacy(await retryLegacyRecovery()); } catch (error) { showError(error, '이전 일정 원본을 보존하고 있어요. 다시 시도해 주세요.'); } finally { setRecovering(false); } };
    const save = async (patch: Partial<UserSettings>, success?: string): Promise<boolean> => {
        setSaveFeedback(null);
        try {
            await saveAssistantSettings(patch);
            if (success) setSaveFeedback(success);
            return true;
        } catch {
            setNotice({ title: '설정 저장 실패', message: '설정을 저장하지 못했습니다. 현재 값을 확인한 뒤 다시 시도해 주세요.' });
            return false;
        }
    };
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
    const permission = async () => {
        try { await requestNotificationPermission(); refresh(); }
        catch { setNotice({ title: '알림 권한 확인', message: '권한 요청을 열지 못했습니다. 시스템 앱 설정에서 확인해 주세요.' }); }
    };
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
            title="설정"
            compact
          />
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: uiSpacing.xs }}>
            {([['basic', '기본 설정'], ['advanced', '고급 설정']] as const).map(([value, label]) => {
              const active = section === value;
              return (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  onPress={() => { setSaveFeedback(null); setSection(value); }}
                  style={{
                    flex: 1,
                    minHeight: uiSizes.touchMinHeight,
                    borderRadius: uiRadii.field,
                    borderWidth: uiSizes.borderWidth,
                    borderColor: active ? colors.primary : colors.inputBorder,
                    backgroundColor: active ? colors.primary : colors.surface,
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: uiSpacing.xs,
                    paddingHorizontal: uiSpacing.sm,
                  }}
                >
                  <Ionicons
                    name={value === 'basic' ? 'settings-outline' : 'options-outline'}
                    size={18}
                    color={active ? colors.onPrimary : colors.textSecondary}
                  />
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {section === 'basic' ? (
            <>
              <SettingsGroup
                title="알림과 아침 브리핑"
                icon="notifications-outline"
              >
                <SettingsToggleRow
                  icon="notifications-outline"
                  title="전체 일정 알림"
                  description="일정 시작 알림"
                  value={settings.pushEnabled}
                  onValueChange={v => { void save({ pushEnabled: v }); }}
                />
                <SettingsToggleRow
                  icon="sunny-outline"
                  title="매일 아침 브리핑"
                  description="설정한 시각에 오늘 일정 안내"
                  value={settings.dailyBriefingEnabled}
                  onValueChange={v => { void save({ dailyBriefingEnabled: v }); }}
                />
                <SettingsActionRow
                  icon="time-outline"
                  title="아침 브리핑 알림 시간"
                  description="시간 변경"
                  status={String(settings.dailyBriefingTime.hour).padStart(2, '0') + ':' + String(settings.dailyBriefingTime.minute).padStart(2, '0')}
                  expanded={editingTime}
                  onPress={() => { setSaveFeedback(null); setEditingTime(value => !value); }}
                />
                {editingTime ? (
                  <View style={{ padding: uiSpacing.sm, gap: uiSpacing.sm, backgroundColor: colors.inputBackground, borderRadius: uiRadii.field }}>
                    <View style={{ flexDirection: 'row', gap: uiSpacing.sm }}>
                      <View style={{ flex: 1, minWidth: 0 }}>{input('시 (0–23)', hour, setHour, 'number-pad')}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>{input('분 (0–59)', minute, setMinute, 'number-pad')}</View>
                    </View>
                    <AssistantButton label="브리핑 시간 저장" icon="checkmark-outline" onPress={() => {
                      const h = Number(hour), m = Number(minute);
                      if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) {
                        setNotice({ title: '시간 확인', message: '0–23시, 0–59분으로 입력해 주세요.' });
                        return;
                      }
                      void save({ dailyBriefingTime: { hour: h, minute: m } }, '브리핑 시간을 저장했습니다.').then(ok => { if (ok) setEditingTime(false); });
                    }} />
                  </View>
                ) : null}
                {saveFeedback && !editingTime ? (
                  <View accessibilityRole="alert" style={{ backgroundColor: colors.primaryLight, paddingHorizontal: uiSpacing.sm, paddingVertical: uiSpacing.xs }}>
                    <Text style={{ color: colors.text }}>{saveFeedback}</Text>
                  </View>
                ) : null}
                <SettingsActionRow
                  icon="shield-checkmark-outline"
                  title="알림 권한 확인 및 요청"
                  description={cap ? (cap.timing === 'exact' ? '정확한 알람 사용 가능' : '일반 알람 · 절전 시 지연될 수 있음') : '기기 권한을 확인하고 있습니다.'}
                  status={cap ? (cap.notificationsAllowed ? '허용됨' : '허용 필요') : '확인 중'}
                  onPress={() => { void permission(); }}
                />
                <SettingsActionRow
                  icon="settings-outline"
                  title="시스템 앱 설정 열기"
                  description="알림·권한 설정"
                  onPress={() => { void Linking.openSettings().catch(e => showError(e, '앱 설정을 열지 못했습니다.')); }}
                />
              </SettingsGroup>
              <SettingsGroup
                title="빠른 설정과 홈 위젯"
                icon="grid-outline"
              >
                <SettingsToggleRow icon="grid-outline" title="빠른 설정 사용" description="끄면 시스템 타일을 사용할 수 없습니다. 다시 켠 뒤 재추가가 필요할 수 있습니다." value={tileEnabled} onValueChange={v => { void toggleTile(v); }} />
                <SettingsActionRow icon="add-circle-outline" title="빠른 설정 타일 추가" description="상단 빠른 설정에 직접 배치" status={!tileEnabled ? '꺼짐' : undefined} onPress={() => { if (tileEnabled) void addTile(); else setNotice({ title: '빠른 설정', message: '먼저 빠른 설정 사용을 켜 주세요.' }); }} />
                <SettingsActionRow icon="calendar-outline" title="다음 일정 위젯 추가" description="가까운 일정 표시" onPress={() => { void pin('small'); }} />
                <SettingsActionRow icon="list-outline" title="오늘 일정 위젯 추가" description="오늘 일정 목록 표시" onPress={() => { void pin('agenda'); }} />
                <SettingsNote>위젯 추가는 Android 홈 화면에서 확인해야 할 수 있습니다.</SettingsNote>
              </SettingsGroup>
              <SettingsGroup title="기기 내 음성과 AI" icon="mic-outline">
                <SettingsStatusRow
                  icon="sparkles-outline"
                  title="Gemini Nano"
                  description={ai.message}
                />
                {ai.status === 'downloadable' ? (
                  <SettingsActionRow icon="cloud-download-outline" title="기기 AI 모델 다운로드" description="기기가 지원하는 Gemini Nano를 직접 내려받습니다. Wi-Fi 사용을 권장합니다." busy={aiDownloading} onPress={() => { void downloadAi(); }} />
                ) : null}
                {aiDownloading || aiProgress ? (
                  <SettingsNote>{aiDownloading ? '다운로드 처리 중 · ' : ''}{aiProgress?.status === 'progress' && aiProgress.totalBytes > 0 ? `${Math.min(100, Math.round(aiProgress.bytesDownloaded / aiProgress.totalBytes * 100))}%` : aiProgress?.status === 'completed' ? '다운로드 완료' : aiProgress?.status === 'failed' ? '다운로드 실패' : '진행 상태 확인 중'}</SettingsNote>
                ) : null}
                <SettingsActionRow
                  icon="mic-outline"
                  title="텍스트 · 음성 입력 열기"
                  description="녹음은 음성 시작 버튼을 누를 때만 실행됩니다."
                  onPress={() => { void PushOfficeNative.openQuickEntry().catch(e => showError(e, '입력 창을 열 수 없습니다.')); }}
                />
              </SettingsGroup>
            </>
          ) : (
            <>
              <SettingsGroup title="선택한 외부 정보" icon="cloud-outline" description="요청할 때만 조회 · 일정 내용은 전송하지 않음">
                <SettingsToggleRow
                  icon="cloudy-outline"
                  title="날씨"
                  description="선택한 도시의 날씨를 조회합니다."
                  value={settings.digestTypes.weather}
                  onValueChange={v => { void save({ digestTypes: { ...settings.digestTypes, weather: v } }); }}
                />
                <SettingsToggleRow
                  icon="newspaper-outline"
                  title="뉴스"
                  description="설정한 키워드의 뉴스를 조회합니다."
                  value={settings.digestTypes.news}
                  onValueChange={v => { void save({ digestTypes: { ...settings.digestTypes, news: v } }); }}
                />
                <SettingsToggleRow
                  icon="trending-up-outline"
                  title="주식"
                  description="관심 종목의 정보를 조회합니다."
                  value={settings.digestTypes.stocks}
                  onValueChange={v => { void save({ digestTypes: { ...settings.digestTypes, stocks: v } }); }}
                />
                <SettingsActionRow
                  icon="options-outline"
                  title="외부 정보 상세 설정"
                  description="도시·키워드·종목"
                  expanded={editingExternal}
                  onPress={() => { setSaveFeedback(null); setEditingExternal(value => !value); }}
                />
                {editingExternal ? (
                  <View style={{ padding: uiSpacing.sm, gap: uiSpacing.sm, backgroundColor: colors.inputBackground, borderRadius: uiRadii.field }}>
                    {input('날씨 도시', city, setCity)}
                    {input('뉴스 키워드 (쉼표 구분)', keywords, setKeywords)}
                    {input('뉴스 언어', language, setLanguage)}
                    {input('주식 종목 (쉼표 구분, 최대 5개)', tickers, setTickers)}
                    <AssistantButton label="외부 정보 설정 저장" icon="checkmark-outline" onPress={() => {
                      void save({
                        digestCity: city.trim(),
                        newsKeywords: keywords.split(',').map(x => x.trim()).filter(Boolean),
                        newsLanguage: language.trim(),
                        stockTickers: tickers.split(',').map(x => x.trim()).filter(Boolean).slice(0, 5),
                      }, '외부 정보 설정을 저장했습니다.').then(ok => { if (ok) setEditingExternal(false); });
                    }} />
                  </View>
                ) : null}
                {saveFeedback && !editingExternal ? (
                  <View accessibilityRole="alert" style={{ backgroundColor: colors.primaryLight, paddingHorizontal: uiSpacing.sm, paddingVertical: uiSpacing.xs }}>
                    <Text style={{ color: colors.text }}>{saveFeedback}</Text>
                  </View>
                ) : null}
              </SettingsGroup>
              <SettingsGroup title="이전 일정 가져오기" icon="cloud-download-outline">
                <SettingsNote>{legacy?.message ?? '이전에 사용하던 Firebase 계정의 일정을 가져올 수 있습니다.'}</SettingsNote>
                <SettingsActionRow
                  icon="refresh-outline"
                  title="Firebase 일정 가져오기 다시 시도"
                  description="원본 보존"
                  busy={recovering}
                  onPress={() => { void retryImport(); }}
                />
              </SettingsGroup>
              <SettingsGroup title="화면과 보관" icon="color-palette-outline">
                <SettingsChoiceRow icon="phone-portrait-outline" title="시스템 테마" selected={settings.themeMode === 'system'} onPress={() => { void save({ themeMode: 'system' }); }} />
                <SettingsChoiceRow icon="sunny-outline" title="밝은 테마" selected={settings.themeMode === 'light'} onPress={() => { void save({ themeMode: 'light' }); }} />
                <SettingsChoiceRow icon="moon-outline" title="어두운 테마" selected={settings.themeMode === 'dark'} onPress={() => { void save({ themeMode: 'dark' }); }} />
                <SettingsNote>일정은 기기에 저장됩니다. 앱 삭제 시 로컬 일정도 삭제되며 Android 자동 백업은 사용하지 않습니다.</SettingsNote>
              </SettingsGroup>
              <SettingsGroup title="개인정보와 지원" icon="shield-checkmark-outline">
                <SettingsNote>기기 AI 상태 확인 시 ML Kit가 식별자와 진단 정보를 처리할 수 있습니다.</SettingsNote>
                <SettingsActionRow
                  icon="document-text-outline"
                  title="개인정보처리방침"
                  description="데이터 처리·보관 정책"
                  onPress={() => { void Linking.openURL('https://hebi10.github.io/pushOffice_app/privacy/').catch(e => showError(e, '개인정보처리방침을 열 수 없습니다.')); }}
                />
                <SettingsActionRow
                  icon="mail-outline"
                  title="지원 문의"
                  description="메일 앱으로 문의"
                  onPress={() => { void Linking.openURL('mailto:asdlkj0104@gmail.com').catch(e => showError(e, '메일 앱을 열 수 없습니다.')); }}
                />
              </SettingsGroup>
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
