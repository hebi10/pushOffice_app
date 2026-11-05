import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { ScreenIntro } from '@/src/components/ui/ScreenIntro';
import { useFocusEffect } from 'expo-router';
import { AssistantButton, AssistantTextField, assistantStyles as s } from '@/src/components/AssistantUI';
import { SettingsActionRow, SettingsChoiceRow, SettingsGroup, SettingsNote, SettingsToggleRow } from '@/src/components/settings/SettingsUI';
import { uiRadii, uiSizes, uiSpacing } from '@/src/lib/designTokens';
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
    const { colors } = useTheme();
    const settings = useAppSelector(x => x.settings);
    const [cap, setCap] = useState<ReminderCapabilities | null>(null);
    const [legacy, setLegacy] = useState<LegacyCloudState | null>(null);
    const [recovering, setRecovering] = useState(false);
    const [ai, setAi] = useState('기기 지원 상태를 확인하고 있습니다.');
    const [section, setSection] = useState<'basic' | 'advanced'>('basic');
    const [editingTime, setEditingTime] = useState(false);
    const [editingExternal, setEditingExternal] = useState(false);
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
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
    const refresh = useCallback(() => { void getLegacyCloudState().then(setLegacy).catch(console.warn); reminderCapabilities().then(setCap).catch(() => setCap(null)); PushOfficeNative.getAiStatus().then(x => setAi(x.message)).catch(() => setAi('로컬 AI 지원 Android 빌드가 필요합니다.')); }, []);
    useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
    useEffect(() => subscribeOnActive(AppState, refresh), [refresh]);
    const retryImport = async () => { setRecovering(true); try { setLegacy(await retryLegacyRecovery()); } catch (error) { showError(error, '이전 일정 원본을 보존하고 있어요. 다시 시도해 주세요.'); } finally { setRecovering(false); } };
    const save = async (patch: Partial<UserSettings>, success?: string): Promise<boolean> => {
        try {
            await saveAssistantSettings(patch);
            if (success) setNotice({ title: '설정 저장 완료', message: success });
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
          eyebrow="나에게 맞는 일정 비서"
          title="내 일정, 내 방식으로"
          description="자주 사용하는 기능부터 차근차근 설정하세요."
          artwork={require('@/assets/images/illustration-settings.jpg')}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['basic', '기본 설정'], ['advanced', '고급 설정']] as const).map(([value, label]) => {
            const active = section === value;
            return (
      <>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenIntro
            eyebrow="PUSH OFFICE"
            title="설정"
            description="일정과 알림을 원하는 방식으로 관리하세요."
            artwork={require('@/assets/images/illustration-settings.jpg')}
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
                  onPress={() => setSection(value)}
                  style={{
                    flex: 1,
                    minHeight: uiSizes.touchMinHeight,
                    borderRadius: uiRadii.field,
                    borderWidth: uiSizes.borderWidth,
                    borderColor: active ? colors.primary : colors.inputBorder,
                    backgroundColor: active ? colors.primary : colors.surface,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: uiSpacing.sm,
                  }}
                >
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {section === 'basic' ? (
            <>
              <SettingsGroup
                title="알림과 아침 브리핑"
                icon="notifications-outline"
                description="일정 알림과 하루 요약을 관리합니다."
              >
                <SettingsToggleRow
                  icon="notifications-outline"
                  title="전체 일정 알림"
                  description="등록한 일정의 시작 알림을 받습니다."
                  value={settings.pushEnabled}
                  onValueChange={v => { void save({ pushEnabled: v }); }}
                />
                <SettingsToggleRow
                  icon="sunny-outline"
                  title="매일 아침 브리핑"
                  description="오늘의 일정을 정해진 시간에 요약합니다."
                  value={settings.dailyBriefingEnabled}
                  onValueChange={v => { void save({ dailyBriefingEnabled: v }); }}
                />
                <SettingsActionRow
                  icon="time-outline"
                  title="아침 브리핑 알림 시간"
                  description="시간을 선택해 변경할 수 있습니다."
                  status={String(settings.dailyBriefingTime.hour).padStart(2, '0') + ':' + String(settings.dailyBriefingTime.minute).padStart(2, '0')}
                  expanded={editingTime}
                  onPress={() => setEditingTime(value => !value)}
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
                  description="알림이 오지 않을 때 시스템 권한을 확인합니다."
                  onPress={() => { void Linking.openSettings().catch(e => showError(e, '앱 설정을 열지 못했습니다.')); }}
                />
              </SettingsGroup>
              <SettingsGroup
                title="빠른 설정과 홈 위젯"
                icon="grid-outline"
                description="홈 화면이나 빠른 설정에서 일정에 접근합니다."
              >
                <SettingsActionRow icon="add-circle-outline" title="빠른 설정 타일 추가" description="상단 빠른 설정에 일정 입력을 추가합니다." onPress={() => { void addTile(); }} />
                <SettingsActionRow icon="calendar-outline" title="다음 일정 위젯 추가" description="가장 가까운 일정 하나를 표시합니다." onPress={() => { void pin('small'); }} />
                <SettingsActionRow icon="list-outline" title="오늘 일정 위젯 추가" description="오늘의 일정 목록을 표시합니다." onPress={() => { void pin('agenda'); }} />
                <SettingsNote>위젯 추가는 Android 홈 화면에서 확인해야 할 수 있습니다.</SettingsNote>
              </SettingsGroup>
              <SettingsGroup title="기기 내 음성과 AI" icon="mic-outline" description="지원하는 기기에서만 일부 기능이 동작합니다.">
                <SettingsActionRow
                  icon="sparkles-outline"
                  title="Gemini Nano"
                  description={ai}
                  onPress={() => { void PushOfficeNative.openQuickEntry().catch(e => showError(e, '입력 창을 열 수 없습니다.')); }}
                />
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
              <SettingsGroup title="선택한 외부 정보" icon="cloud-outline" description="홈에서 직접 불러올 때만 요청합니다. 일정 내용은 전송하지 않습니다.">
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
                  description="날씨 도시, 뉴스 키워드·언어, 주식 종목"
                  expanded={editingExternal}
                  onPress={() => setEditingExternal(value => !value)}
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
              </SettingsGroup>
              <SettingsGroup title="이전 일정 가져오기" icon="cloud-download-outline">
                <SettingsNote>{legacy?.message ?? '이전에 사용하던 Firebase 계정의 일정을 가져올 수 있습니다.'}</SettingsNote>
                <SettingsActionRow
                  icon="refresh-outline"
                  title="Firebase 일정 가져오기 다시 시도"
                  description="기존 원본을 삭제하거나 변경하지 않습니다."
                  busy={recovering}
                  onPress={() => { void retryImport(); }}
                />
              </SettingsGroup>
              <SettingsGroup title="화면과 보관" icon="color-palette-outline" description="화면 테마를 선택하고 데이터 저장 방식을 확인하세요.">
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
                  description="데이터 처리와 보관 정책을 확인합니다."
                  onPress={() => { void Linking.openURL('https://hebi10.github.io/pushOffice_app/privacy/').catch(e => showError(e, '개인정보처리방침을 열 수 없습니다.')); }}
                />
                <SettingsActionRow
                  icon="mail-outline"
                  title="지원 문의"
                  description="메일 앱에서 문의 내용을 작성합니다."
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
