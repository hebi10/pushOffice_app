/**
 * Settings 화면 – 테마/폰트/알림/브리핑/저장 모드 설정
 */
import { Card } from '@/src/components/Card';
import { KeyboardLayout } from '@/src/components/KeyboardLayout';
import { showError, showToast } from '@/src/components/ui/toast';
import { useTheme } from '@/src/contexts/ThemeContext';
import { signInAnon, updateUserSettings } from '@/src/features/auth/authService';
import {
    cancelDailyBriefing,
    registerBackgroundDigestTask,
    registerPushToken,
    requestNotificationPermission,
    scheduleDailyBriefing,
    scheduleLocalDigestNotification,
    unregisterBackgroundDigestTask,
} from '@/src/features/notifications';
import {
    getOrCreateDeviceKey,
    localGetAllDigests,
    localGetAllSchedules,
    localSaveSettings,
    setStorageMode,
} from '@/src/features/storage';
import { db } from '@/src/lib/firebase';
import { KOREA_REGIONS, SIDO_LIST } from '@/src/lib/regions';
import { FONT_MAP } from '@/src/lib/theme';
import {
    setDailyBriefing,
    setDigestCity,
    setDigestTypes,
    setFontFamily,
    setNewsCategories,
    setNewsKeywords,
    setPushEnabled,
    setStockTickers,
    setThemeMode,
    setWeatherRegion,
} from '@/src/store/slices/settingsSlice';
import { setDeviceKey, setMode } from '@/src/store/slices/storageModeSlice';
import { useAppDispatch, useAppSelector } from '@/src/store/store';
import type { FontFamily, ThemeMode, WeatherRegion } from '@/src/types';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** 30분 간격 브리핑 시간 목록 (6:00 ~ 10:30) */
const BRIEFING_TIMES: { hour: number; minute: number; label: string }[] = [];
for (let h = 6; h <= 10; h++) {
  BRIEFING_TIMES.push({ hour: h, minute: 0, label: `${h}:00` });
  if (h < 10) BRIEFING_TIMES.push({ hour: h, minute: 30, label: `${h}:30` });
}
BRIEFING_TIMES.push({ hour: 10, minute: 30, label: '10:30' });

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'system', label: '시스템', icon: 'phone-portrait-outline' },
  { value: 'light', label: '라이트', icon: 'sunny-outline' },
  { value: 'dark', label: '다크', icon: 'moon-outline' },
];

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'pretendard', label: FONT_MAP.pretendard.label },
  { value: 'noto-sans', label: FONT_MAP['noto-sans'].label },
  { value: 'nanum-gothic', label: FONT_MAP['nanum-gothic'].label },
  { value: 'nanum-myeongjo', label: FONT_MAP['nanum-myeongjo'].label },
];

const NEWS_CATEGORIES = ['경제', 'IT/과학', '사회', '정치', '세계', '문화', '스포츠', '건강'];

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.auth.uid);
  const settings = useAppSelector((s) => s.settings);
  const storageMode = useAppSelector((s) => s.storageMode.mode);
  const { colors } = useTheme();

  const [tickerInput, setTickerInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [cityInput, setCityInput] = useState(settings.digestCity);
  const [isMigrating, setIsMigrating] = useState(false);
  const [fontExpanded, setFontExpanded] = useState(false);
  const [regionSidoExpanded, setRegionSidoExpanded] = useState(false);
  const [regionGugunExpanded, setRegionGugunExpanded] = useState(false);
  const [selectedSido, setSelectedSido] = useState(settings.weatherRegion?.sido ?? '');
  const [selectedGugun, setSelectedGugun] = useState(settings.weatherRegion?.gugun ?? '');

  /** 설정 값 저장 헬퍼 */
  const persistSetting = useCallback(
    async (patch: Record<string, unknown>) => {
      if (storageMode === 'firebase' && uid) {
        await updateUserSettings(uid, patch as any).catch(showError);
      } else {
        await localSaveSettings(patch as any);
      }
    },
    [storageMode, uid],
  );

  /** 테마 모드 변경 */
  const handleThemeChange = useCallback(
    async (mode: ThemeMode) => {
      dispatch(setThemeMode(mode));
      await persistSetting({ themeMode: mode });
    },
    [dispatch, persistSetting],
  );

  /** 폰트 변경 */
  const handleFontChange = useCallback(
    async (font: FontFamily) => {
      dispatch(setFontFamily(font));
      await persistSetting({ fontFamily: font });
    },
    [dispatch, persistSetting],
  );

  /** 알림 권한 토글 */
  const handlePushToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }
      dispatch(setPushEnabled(value));
      await persistSetting({ pushEnabled: value });
    },
    [dispatch, persistSetting],
  );

  /** 브리핑 토글 */
  const handleBriefingToggle = useCallback(
    async (value: boolean) => {
      dispatch(setDailyBriefing({ enabled: value }));

      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          dispatch(setDailyBriefing({ enabled: false }));
          return;
        }
        try {
          if (storageMode === 'firebase') {
            await scheduleDailyBriefing(
              settings.dailyBriefingTime.hour,
              settings.dailyBriefingTime.minute,
            );
            if (uid) await registerPushToken(uid);
          } else {
            await scheduleLocalDigestNotification(
              settings.dailyBriefingTime.hour,
              settings.dailyBriefingTime.minute,
            );
            await registerBackgroundDigestTask();
          }
          const { hour, minute } = settings.dailyBriefingTime;
          const timeStr = `${hour}:${minute.toString().padStart(2, '0')}`;
          showToast(`매일 ${timeStr} 브리핑`);
        } catch (error) {
          showError(error);
        }
      } else {
        await cancelDailyBriefing();
        if (storageMode === 'local') {
          await unregisterBackgroundDigestTask();
        }
      }

      await persistSetting({ dailyBriefingEnabled: value });
    },
    [dispatch, uid, settings.dailyBriefingTime, storageMode, persistSetting],
  );

  /** 브리핑 시간 선택 */
  const handleBriefingTime = useCallback(
    async (hour: number, minute: number) => {
      dispatch(setDailyBriefing({ enabled: true, hour, minute }));

      if (settings.dailyBriefingEnabled) {
        try {
          if (storageMode === 'firebase') {
            await scheduleDailyBriefing(hour, minute);
          } else {
            await scheduleLocalDigestNotification(hour, minute);
          }
          const timeStr = `${hour}:${minute.toString().padStart(2, '0')}`;
          showToast(`브리핑 시간: 매일 ${timeStr}`);
        } catch (error) {
          showError(error);
        }
      }

      await persistSetting({ dailyBriefingTime: { hour, minute } });
    },
    [dispatch, settings.dailyBriefingEnabled, storageMode, persistSetting],
  );

  /** Digest 유형 토글 */
  const handleDigestTypeToggle = useCallback(
    async (key: 'weather' | 'stocks' | 'news', value: boolean) => {
      const updated = { ...settings.digestTypes, [key]: value };
      dispatch(setDigestTypes(updated));
      await persistSetting({ digestTypes: updated });
    },
    [dispatch, settings.digestTypes, persistSetting],
  );

  /** 도시 저장 */
  const handleSaveCity = useCallback(async () => {
    if (!cityInput.trim()) return;
    dispatch(setDigestCity(cityInput.trim()));
    await persistSetting({ digestCity: cityInput.trim() });
    showToast('날씨 지역 저장');
  }, [dispatch, cityInput, persistSetting]);

  /** 종목 추가 */
  const handleAddTicker = useCallback(async () => {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;
    if (settings.stockTickers.length >= 5) {
      Alert.alert('알림', '관심 종목은 최대 5개까지 등록 가능합니다.');
      return;
    }
    if (settings.stockTickers.includes(ticker)) {
      setTickerInput('');
      return;
    }
    const updated = [...settings.stockTickers, ticker];
    dispatch(setStockTickers(updated));
    setTickerInput('');
    await persistSetting({ stockTickers: updated });
  }, [dispatch, tickerInput, settings.stockTickers, persistSetting]);

  /** 종목 삭제 */
  const handleRemoveTicker = useCallback(
    async (ticker: string) => {
      const updated = settings.stockTickers.filter((t) => t !== ticker);
      dispatch(setStockTickers(updated));
      await persistSetting({ stockTickers: updated });
    },
    [dispatch, settings.stockTickers, persistSetting],
  );

  /** 뉴스 키워드 추가 */
  const handleAddKeyword = useCallback(async () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    if (settings.newsKeywords.includes(kw)) {
      setKeywordInput('');
      return;
    }
    const updated = [...settings.newsKeywords, kw];
    dispatch(setNewsKeywords(updated));
    setKeywordInput('');
    await persistSetting({ newsKeywords: updated });
  }, [dispatch, keywordInput, settings.newsKeywords, persistSetting]);

  /** 뉴스 키워드 삭제 */
  const handleRemoveKeyword = useCallback(
    async (kw: string) => {
      const updated = settings.newsKeywords.filter((k) => k !== kw);
      dispatch(setNewsKeywords(updated));
      await persistSetting({ newsKeywords: updated });
    },
    [dispatch, settings.newsKeywords, persistSetting],
  );

  /** 지역 선택: 시/도 */
  const handleSelectSido = useCallback(
    async (sido: string) => {
      setSelectedSido(sido);
      setSelectedGugun('');
      setRegionSidoExpanded(false);
      setRegionGugunExpanded(true);
    },
    [],
  );

  /** 지역 선택: 구/군 */
  const handleSelectGugun = useCallback(
    async (gugun: string) => {
      setSelectedGugun(gugun);
      setRegionGugunExpanded(false);
      const region: WeatherRegion = { sido: selectedSido, gugun };
      dispatch(setWeatherRegion(region));
      // 도시명도 함께 업데이트 (날씨 API 호환)
      dispatch(setDigestCity(`${selectedSido} ${gugun}`));
      await persistSetting({ weatherRegion: region, digestCity: `${selectedSido} ${gugun}` });
      showToast(`날씨 지역: ${selectedSido} ${gugun}`);
    },
    [dispatch, selectedSido, persistSetting],
  );

  /** 뉴스 카테고리 토글 */
  const handleToggleCategory = useCallback(
    async (cat: string) => {
      const current = settings.newsCategories ?? [];
      const updated = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      dispatch(setNewsCategories(updated));
      await persistSetting({ newsCategories: updated });
    },
    [dispatch, settings.newsCategories, persistSetting],
  );

  /** 저장 모드 전환: local → firebase */
  const handleSwitchToFirebase = useCallback(async () => {
    setIsMigrating(true);
    try {
      const user = await signInAnon();
      await setStorageMode('firebase');
      dispatch(setMode('firebase'));

      const localSchedules = await localGetAllSchedules();
      const localDigests = await localGetAllDigests();

      for (const s of localSchedules) {
        await addDoc(collection(db, 'schedules'), {
          ...s,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const d of localDigests) {
        await addDoc(collection(db, 'digests'), {
          ...d,
          ownerType: 'user',
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      showToast('로그인 완료, 데이터 백업 완료');
    } catch (error) {
      showError(error, '모드 전환에 실패했습니다.');
    } finally {
      setIsMigrating(false);
    }
  }, [dispatch]);

  /** 저장 모드 전환: firebase → local */
  const handleSwitchToLocal = useCallback(async () => {
    await setStorageMode('local');
    const key = await getOrCreateDeviceKey();
    dispatch(setMode('local'));
    dispatch(setDeviceKey(key));
    showToast('로컬 모드로 전환');
  }, [dispatch]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <KeyboardLayout insideTab>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 테마 모드 */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>테마</Text>
          <View style={styles.segmentRow}>
            {THEME_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.segmentBtn,
                  { borderColor: colors.inputBorder },
                  settings.themeMode === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handleThemeChange(opt.value)}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={settings.themeMode === opt.value ? '#FFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: settings.themeMode === opt.value ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* 폰트 (드롭다운) */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>글꼴</Text>
          <TouchableOpacity
            style={[styles.dropdownBtn, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
            onPress={() => setFontExpanded((v) => !v)}
          >
            <Text style={[styles.dropdownBtnText, { color: colors.text }]}>
              {FONT_OPTIONS.find((f) => f.value === settings.fontFamily)?.label ?? '선택'}
            </Text>
            <Ionicons
              name={fontExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          {fontExpanded && (
            <View style={[styles.dropdownList, { borderColor: colors.inputBorder, backgroundColor: colors.surface }]}>
              {FONT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.divider },
                    settings.fontFamily === opt.value && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => {
                    handleFontChange(opt.value);
                    setFontExpanded(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }]}>{opt.label}</Text>
                  {settings.fontFamily === opt.value && (
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* 저장 모드 */}
        <Card>
          <Text style={[styles.rowTitle, { color: colors.text }]}>저장 모드</Text>
          <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
            {storageMode === 'firebase' ? '로그인 백업 사용 중' : '로컬 저장 모드'}
          </Text>
          <View style={styles.modeActions}>
            {storageMode === 'local' ? (
              <TouchableOpacity
                style={[styles.modeBtn, { backgroundColor: colors.primary }]}
                onPress={handleSwitchToFirebase}
                disabled={isMigrating}
              >
                <Text style={styles.modeBtnText}>
                  {isMigrating ? '전환 중...' : '로그인하여 백업 사용'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.modeBtnOutline, { borderColor: colors.primary }]}
                onPress={handleSwitchToLocal}
              >
                <Text style={[styles.modeBtnOutlineText, { color: colors.primary }]}>로컬 모드로 전환</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* 알림 */}
        <Card>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>푸시 알림</Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>일정 알림을 받습니다</Text>
            </View>
            <Switch
              value={settings.pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ true: colors.primary, false: colors.inputBorder }}
            />
          </View>
        </Card>

        {/* 일일 브리핑 */}
        <Card>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>일일 브리핑</Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>매일 선택한 항목을 브리핑합니다</Text>
            </View>
            <Switch
              value={settings.dailyBriefingEnabled}
              onValueChange={handleBriefingToggle}
              trackColor={{ true: colors.primary, false: colors.inputBorder }}
            />
          </View>

          {settings.dailyBriefingEnabled && (
            <View style={[styles.timeSelector, { borderTopColor: colors.divider }]}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>알림 시간</Text>
              <View style={styles.timeOptions}>
                {BRIEFING_TIMES.map((t) => {
                  const isActive =
                    settings.dailyBriefingTime.hour === t.hour &&
                    settings.dailyBriefingTime.minute === t.minute;
                  return (
                    <TouchableOpacity
                      key={t.label}
                      style={[
                        styles.timeChip,
                        { backgroundColor: colors.inputBackground },
                        isActive && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => handleBriefingTime(t.hour, t.minute)}
                    >
                      <Text
                        style={[
                          styles.timeChipText,
                          { color: colors.textSecondary },
                          isActive && { color: '#FFF', fontWeight: '600' },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* 브리핑 항목 설정 */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>브리핑 항목</Text>

          <View style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>날씨</Text>
            <Switch
              value={settings.digestTypes.weather}
              onValueChange={(v) => handleDigestTypeToggle('weather', v)}
              trackColor={{ true: colors.primary, false: colors.inputBorder }}
            />
          </View>

          {settings.digestTypes.weather && (
            <View style={styles.regionSection}>
              <Text style={[styles.regionLabel, { color: colors.textSecondary }]}>
                {selectedSido && selectedGugun
                  ? `현재: ${selectedSido} ${selectedGugun}`
                  : '지역을 선택하세요'}
              </Text>

              {/* 시/도 선택 */}
              <TouchableOpacity
                style={[styles.dropdownBtn, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  setRegionSidoExpanded((v) => !v);
                  setRegionGugunExpanded(false);
                }}
              >
                <Text style={[styles.dropdownBtnText, { color: selectedSido ? colors.text : colors.textTertiary }]}>
                  {selectedSido || '시/도 선택'}
                </Text>
                <Ionicons
                  name={regionSidoExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              {regionSidoExpanded && (
                <ScrollView
                  style={[styles.dropdownList, styles.regionDropdown, { borderColor: colors.inputBorder, backgroundColor: colors.surface }]}
                  nestedScrollEnabled
                >
                  {SIDO_LIST.map((sido) => (
                    <TouchableOpacity
                      key={sido}
                      style={[
                        styles.dropdownItem,
                        { borderBottomColor: colors.divider },
                        selectedSido === sido && { backgroundColor: colors.primaryLight },
                      ]}
                      onPress={() => handleSelectSido(sido)}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{sido}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* 구/군 선택 */}
              {selectedSido && (
                <>
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, marginTop: 8 }]}
                    onPress={() => {
                      setRegionGugunExpanded((v) => !v);
                      setRegionSidoExpanded(false);
                    }}
                  >
                    <Text style={[styles.dropdownBtnText, { color: selectedGugun ? colors.text : colors.textTertiary }]}>
                      {selectedGugun || '구/군 선택'}
                    </Text>
                    <Ionicons
                      name={regionGugunExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {regionGugunExpanded && KOREA_REGIONS[selectedSido] && (
                    <ScrollView
                      style={[styles.dropdownList, styles.regionDropdown, { borderColor: colors.inputBorder, backgroundColor: colors.surface }]}
                      nestedScrollEnabled
                    >
                      {KOREA_REGIONS[selectedSido].map((gugun) => (
                        <TouchableOpacity
                          key={gugun}
                          style={[
                            styles.dropdownItem,
                            { borderBottomColor: colors.divider },
                            selectedGugun === gugun && { backgroundColor: colors.primaryLight },
                          ]}
                          onPress={() => handleSelectGugun(gugun)}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.text }]}>{gugun}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          )}

          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>주식</Text>
            <Switch
              value={settings.digestTypes.stocks}
              onValueChange={(v) => handleDigestTypeToggle('stocks', v)}
              trackColor={{ true: colors.primary, false: colors.inputBorder }}
            />
          </View>

          {settings.digestTypes.stocks && (
            <View style={styles.tickerSection}>
              <View style={styles.inlineInput}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                  placeholder="종목 코드 (예: AAPL)"
                  placeholderTextColor={colors.textTertiary}
                  value={tickerInput}
                  onChangeText={setTickerInput}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleAddTicker}
                />
                <TouchableOpacity style={[styles.addChip, { backgroundColor: colors.primary }]} onPress={handleAddTicker}>
                  <Text style={styles.addChipText}>추가</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipRow}>
                {settings.stockTickers.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, { backgroundColor: colors.primaryLight }]}
                    onPress={() => handleRemoveTicker(t)}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>{t} x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>주요 뉴스</Text>
            <Switch
              value={settings.digestTypes.news}
              onValueChange={(v) => handleDigestTypeToggle('news', v)}
              trackColor={{ true: colors.primary, false: colors.inputBorder }}
            />
          </View>

          {settings.digestTypes.news && (
            <View style={styles.tickerSection}>
              <View style={styles.inlineInput}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                  placeholder="키워드 (선택)"
                  placeholderTextColor={colors.textTertiary}
                  value={keywordInput}
                  onChangeText={setKeywordInput}
                  returnKeyType="done"
                  onSubmitEditing={handleAddKeyword}
                />
                <TouchableOpacity style={[styles.addChip, { backgroundColor: colors.primary }]} onPress={handleAddKeyword}>
                  <Text style={styles.addChipText}>추가</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipRow}>
                {settings.newsKeywords.map((kw) => (
                  <TouchableOpacity
                    key={kw}
                    style={[styles.chip, { backgroundColor: colors.primaryLight }]}
                    onPress={() => handleRemoveKeyword(kw)}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>{kw} x</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 뉴스 카테고리 */}
              <Text style={[styles.catLabel, { color: colors.textSecondary }]}>카테고리</Text>
              <View style={styles.chipRow}>
                {NEWS_CATEGORIES.map((cat) => {
                  const isActive = (settings.newsCategories ?? []).includes(cat);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        { borderColor: colors.inputBorder },
                        isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => handleToggleCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          { color: colors.textSecondary },
                          isActive && { color: '#FFF' },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* 계정 정보 */}
        <Card>
          <Text style={[styles.rowTitle, { color: colors.text }]}>계정</Text>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            {storageMode === 'firebase' && uid
              ? `UID: ${uid.slice(0, 12)}...`
              : '로컬 모드'}
          </Text>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>타임존: {settings.timezone}</Text>
        </Card>

        {/* 앱 정보 */}
        <Card>
          <Text style={[styles.rowTitle, { color: colors.text }]}>앱 정보</Text>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>Push Office v1.0.0</Text>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>Expo + Firebase</Text>
        </Card>
      </ScrollView>
      </KeyboardLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingVertical: 12 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowDesc: { fontSize: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },

  /* 테마 세그먼트 */
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '500' },

  /* 폰트 */
  fontRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fontLabel: { fontSize: 15 },

  /* 드롭다운 */
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownBtnText: { fontSize: 14 },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownItemText: { fontSize: 14 },

  /* 날씨 지역 */
  regionSection: { marginTop: 8 },
  regionLabel: { fontSize: 12, marginBottom: 6 },
  regionDropdown: { maxHeight: 200 },

  /* 뉴스 카테고리 */
  catLabel: { fontSize: 13, fontWeight: '500', marginTop: 12, marginBottom: 6 },
  catChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catChipText: { fontSize: 13 },

  /* 브리핑 시간 */
  timeSelector: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timeLabel: { fontSize: 13, marginBottom: 8 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timeChipText: { fontSize: 13 },

  infoText: { fontSize: 13, marginTop: 4 },

  inlineInput: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },

  tickerSection: { marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 13 },
  addChip: {
    marginLeft: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChipText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  modeActions: { marginTop: 10 },
  modeBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  modeBtnOutline: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnOutlineText: { fontSize: 14, fontWeight: '600' },
});
