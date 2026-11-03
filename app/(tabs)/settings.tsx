import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AssistantButton, AssistantCard, assistantStyles as s } from '@/src/components/AssistantUI';
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
    const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => <View style={s.row}>
    <Text style={[s.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.primary }}/>
    </View>;
    const input = (label: string, value: string, onChangeText: (s: string) => void, keyboardType: 'default' | 'number-pad' = 'default') => <View style={{ gap: 5 }}>
    <Text style={[s.caption, { color: colors.textSecondary }]}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholderTextColor={colors.textTertiary} style={[s.input, { borderColor: colors.divider, color: colors.text, backgroundColor: colors.background }]}/>
    </View>;
    const permission = async () => { await requestNotificationPermission(); refresh(); };
    const addTile = async () => { try {
        const status = await PushOfficeNative.requestAddTile();
        const labels: Record<string, string> = { added: '빠른 설정에 타일을 추가했어요.', already_added: '이미 빠른 설정에 추가되어 있어요.', not_added: '추가하지 않았어요. 빠른 설정 편집에서도 직접 배치할 수 있어요.', unsupported_manual: '이 Android 버전에서는 빠른 설정 편집에서 Push Office를 직접 추가해 주세요.' };
        Alert.alert('빠른 설정 타일', labels[status] ?? `시스템 응답: ${status}`);
    }
    catch (e) {
        showError(e, '타일 추가 요청을 열 수 없습니다.');
    } };
    const pin = async (kind: 'small' | 'agenda') => { try {
        const accepted = await PushOfficeNative.requestPinWidget(kind);
        Alert.alert('홈 화면 위젯', accepted ? '런처에 추가 요청을 전달했어요. 표시된 확인 창에서 추가를 완료해 주세요.' : '이 런처는 위젯 추가 요청을 지원하지 않아요. 홈 화면을 길게 누른 뒤 위젯에서 Push Office를 선택해 주세요.');
    }
    catch (e) {
        showError(e, '위젯 추가 요청을 열 수 없습니다.');
    } };
    return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 <View>
    <Text style={[s.heading, { color: colors.text }]}>내 일정, 내 기기에서</Text>
    <Text style={[s.subtitle, { color: colors.textSecondary, marginTop: 6 }]}>로그인 없이 일정·알림·위젯을 함께 사용해요.</Text>
    </View>
 <AssistantCard title="알림과 아침 브리핑">{toggle('전체 일정 알림', settings.pushEnabled, v => { void save({ pushEnabled: v }); })}{toggle('매일 아침 브리핑', settings.dailyBriefingEnabled, v => { void save({ dailyBriefingEnabled: v }); })}<View style={{ flexDirection: 'row', gap: 12 }}>
    <View style={{ flex: 1 }}>{input('브리핑 시 (0–23)', hour, setHour, 'number-pad')}</View>
    <View style={{ flex: 1 }}>{input('브리핑 분 (0–59)', minute, setMinute, 'number-pad')}</View>
    </View>
    <AssistantButton label="브리핑 시간 저장" icon="time-outline" secondary onPress={() => { const h = Number(hour), m = Number(minute); if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) {
        Alert.alert('시간 확인', '0–23시, 0–59분으로 입력해 주세요.');
        return;
    } void save({ dailyBriefingTime: { hour: h, minute: m } }); }}/>
    <Text style={[s.caption, { color: colors.textSecondary }]}>알림 권한: {cap ? (cap.notificationsAllowed ? '허용됨' : '허용 필요') : 'Android 빌드에서 확인 가능'}{'\n'}예약 방식: {cap?.timing === 'exact' ? '정확한 알람 허용' : cap ? '일반 알람 · 절전 상태에 따라 시간이 늦어질 수 있어요.' : '확인 중'}{'\n'}일정 변경과 재부팅 후에도 기기가 알림을 관리합니다.</Text>
    <AssistantButton label="알림 권한 요청" icon="notifications-outline" secondary onPress={() => { void permission(); }}/>
    <AssistantButton label="시스템 앱 설정 열기" icon="settings-outline" secondary onPress={() => Linking.openSettings()}/>
    </AssistantCard>
 <AssistantCard title="빠른 설정과 홈 위젯">
    <Text style={[s.body, { color: colors.textSecondary }]}>화면 위에서 내려 타일을 누르거나, 홈 위젯에서 바로 입력하세요. 잠금 해제 후 입력 창이 열립니다.</Text>
    <AssistantButton label="빠른 설정 타일 추가" icon="grid-outline" onPress={() => { void addTile(); }}/>
    <AssistantButton label="작은 다음 일정 위젯 추가" icon="albums-outline" secondary onPress={() => { void pin('small'); }}/>
    <AssistantButton label="오늘 일정 위젯 추가" icon="list-outline" secondary onPress={() => { void pin('agenda'); }}/>
    <Text style={[s.caption, { color: colors.textSecondary }]}>요청 뒤 시스템에서 직접 배치를 확인해 주세요. 홈 화면 길게 누르기 → 위젯에서도 추가할 수 있어요.</Text>
    </AssistantCard>
 <AssistantCard title="기기 내 음성과 AI">
    <Text style={[s.body, { color: colors.text }]}>Gemini Nano{'\n'}{ai}</Text>
    <Text style={[s.caption, { color: colors.textSecondary }]}>지원되는 기기와 모델에서만 전면 화면의 AI 요약을 사용합니다. 모델을 내려받아야 하거나 지원되지 않으면 기본 입력과 로컬 요약을 계속 사용할 수 있어요.{'\n\n'}음성은 입력 창에서 직접 버튼을 누를 때만 시작합니다. 기기 내 한국어 인식이 필요하며 지원 여부와 마이크 권한은 해당 기기에서 확인됩니다. 음성과 일정 내용을 외부 AI로 자동 전송하지 않습니다.</Text>
    <AssistantButton label="텍스트 · 음성 입력 열기" icon="mic-outline" secondary onPress={() => PushOfficeNative.openQuickEntry().catch(e => showError(e, '입력 창을 열 수 없습니다.'))}/>
    </AssistantCard>
 <AssistantCard title="선택한 외부 정보"> <Text style={[s.caption, { color: colors.textSecondary }]}>아래 항목은 홈의 ‘외부 브리핑 불러오기’를 누를 때만 외부 서비스에 요청합니다. 일정 내용은 요청에 포함하지 않습니다.</Text>{toggle('날씨', settings.digestTypes.weather, v => { void save({ digestTypes: { ...settings.digestTypes, weather: v } }); })}{input('날씨 도시', city, setCity)}{toggle('뉴스', settings.digestTypes.news, v => { void save({ digestTypes: { ...settings.digestTypes, news: v } }); })}{input('뉴스 키워드 (쉼표 구분)', keywords, setKeywords)}{input('뉴스 언어', language, setLanguage)}{toggle('주식', settings.digestTypes.stocks, v => { void save({ digestTypes: { ...settings.digestTypes, stocks: v } }); })}{input('주식 종목 (쉼표 구분, 최대 5개)', tickers, setTickers)}
    <AssistantButton label="외부 정보 설정 저장" icon="checkmark" secondary onPress={() => { void save({digestCity:city.trim(),newsKeywords:keywords.split(',').map(x=>x.trim()).filter(Boolean),newsLanguage:language.trim(),stockTickers:tickers.split(',').map(x=>x.trim()).filter(Boolean).slice(0,5)}); }}/></AssistantCard>
 <AssistantCard title="이전 일정 가져오기">
    <Text style={[s.body, {color:colors.text}]}>{legacy?.message ?? '이전에 사용하던 Firebase 계정이 있다면 기존 일정을 로컬로 가져올 수 있어요.'}</Text>
    <Text style={[s.caption, {color:colors.textSecondary}]}>기기 일정은 계속 사용할 수 있습니다. 기존 설정과 로그인된 계정만 확인하며 새 계정을 만들거나 Firebase 원본을 수정·삭제하지 않습니다. 설정·로그인이 준비되지 않으면 대기 상태를 보존합니다.</Text>
    <AssistantButton label="이전 Firebase 일정 가져오기 다시 시도" icon="refresh-outline" secondary busy={recovering} onPress={() => { void retryImport(); }}/>
 </AssistantCard>
 <AssistantCard title="화면과 보관">
    <View style={{ gap: 8 }}>{([['system', '시스템 테마'], ['light', '밝은 테마'], ['dark', '어두운 테마']] as const).map(([key, label]) => <AssistantButton key={key} label={`${settings.themeMode === key ? '✓ ' : ''}${label}`} icon="contrast-outline" secondary onPress={() => { void save({ themeMode: key }); }}/>)}</View>
    <Text style={[s.caption, { color: colors.textSecondary }]}>일정은 이 기기에 저장됩니다. 앱 삭제 시 로컬 데이터도 삭제됩니다. Android 자동 백업은 사용하지 않습니다. 이전에 사용하던 Firebase 일정은 원본을 보존한 채 한 번만 가져옵니다.</Text>
    </AssistantCard>
 <AssistantCard title="개인정보와 지원">
    <Text style={[s.caption, { color: colors.textSecondary }]}>기기 AI의 준비 상태를 확인할 때 Google ML Kit가 식별자와 진단 정보를 처리할 수 있습니다. 자세한 정보 처리·삭제 방법은 개인정보처리방침에서 확인해 주세요.</Text>
    <AssistantButton label="개인정보처리방침" icon="shield-checkmark-outline" secondary onPress={() => { void Linking.openURL('https://hebi10.github.io/pushOffice_app/privacy/').catch(e => showError(e, '개인정보처리방침을 열 수 없습니다.')); }}/>
    <AssistantButton label="지원 문의 · asdlkj0104@gmail.com" icon="mail-outline" secondary onPress={() => { void Linking.openURL('mailto:asdlkj0104@gmail.com').catch(e => showError(e, '메일 앱을 열 수 없습니다.')); }}/>
    </AssistantCard>
 </ScrollView>;
}
