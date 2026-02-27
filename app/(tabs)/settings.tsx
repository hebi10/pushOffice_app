/**
 * Settings 화면 – 알림/브리핑/저장 모드 설정
 */
import { Card } from '@/src/components/Card';
import { showError, showToast } from '@/src/components/ui/toast';
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
import {
  setDailyBriefing,
  setDigestCity,
  setDigestTypes,
  setNewsKeywords,
  setPushEnabled,
  setStockTickers
} from '@/src/store/slices/settingsSlice';
import { setDeviceKey, setMode } from '@/src/store/slices/storageModeSlice';
import { useAppDispatch, useAppSelector } from '@/src/store/store';
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

const BRIEFING_HOURS = [6, 7, 8, 9, 10];

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.auth.uid);
  const settings = useAppSelector((s) => s.settings);
  const storageMode = useAppSelector((s) => s.storageMode.mode);

  const [tickerInput, setTickerInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [cityInput, setCityInput] = useState(settings.digestCity);
  const [isMigrating, setIsMigrating] = useState(false);

  /** 알림 권한 토글 */
  const handlePushToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }
      dispatch(setPushEnabled(value));
      if (storageMode === 'firebase' && uid) {
        try {
          await updateUserSettings(uid, { pushEnabled: value });
        } catch (error) {
          showError(error);
        }
      } else {
        await localSaveSettings({ pushEnabled: value });
      }
    },
    [dispatch, uid, storageMode],
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
          showToast(`매일 ${settings.dailyBriefingTime.hour}시 브리핑`);
        } catch (error) {
          showError(error);
        }
      } else {
        await cancelDailyBriefing();
        if (storageMode === 'local') {
          await unregisterBackgroundDigestTask();
        }
      }

      if (storageMode === 'firebase' && uid) {
        try {
          await updateUserSettings(uid, { dailyBriefingEnabled: value });
        } catch (error) {
          showError(error);
        }
      } else {
        await localSaveSettings({ dailyBriefingEnabled: value });
      }
    },
    [dispatch, uid, settings.dailyBriefingTime, storageMode],
  );

  /** 브리핑 시간 선택 */
  const handleBriefingHour = useCallback(
    async (hour: number) => {
      dispatch(setDailyBriefing({ enabled: true, hour, minute: 0 }));

      if (settings.dailyBriefingEnabled) {
        try {
          if (storageMode === 'firebase') {
            await scheduleDailyBriefing(hour, 0);
          } else {
            await scheduleLocalDigestNotification(hour, 0);
          }
          showToast(`브리핑 시간: 매일 ${hour}시`);
        } catch (error) {
          showError(error);
        }
      }

      if (storageMode === 'firebase' && uid) {
        try {
          await updateUserSettings(uid, { dailyBriefingTime: { hour, minute: 0 } });
        } catch (error) {
          showError(error);
        }
      } else {
        await localSaveSettings({ dailyBriefingTime: { hour, minute: 0 } });
      }
    },
    [dispatch, uid, settings.dailyBriefingEnabled, storageMode],
  );

  /** Digest 유형 토글 */
  const handleDigestTypeToggle = useCallback(
    async (key: 'weather' | 'stocks' | 'news', value: boolean) => {
      const updated = { ...settings.digestTypes, [key]: value };
      dispatch(setDigestTypes(updated));
      if (storageMode === 'firebase' && uid) {
        await updateUserSettings(uid, { digestTypes: updated } as any).catch(showError);
      } else {
        await localSaveSettings({ digestTypes: updated });
      }
    },
    [dispatch, uid, settings.digestTypes, storageMode],
  );

  /** 도시 저장 */
  const handleSaveCity = useCallback(async () => {
    if (!cityInput.trim()) return;
    dispatch(setDigestCity(cityInput.trim()));
    if (storageMode === 'firebase' && uid) {
      await updateUserSettings(uid, { digestCity: cityInput.trim() } as any).catch(showError);
    } else {
      await localSaveSettings({ digestCity: cityInput.trim() });
    }
    showToast('날씨 지역 저장');
  }, [dispatch, uid, cityInput, storageMode]);

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
    if (storageMode === 'firebase' && uid) {
      await updateUserSettings(uid, { stockTickers: updated } as any).catch(showError);
    } else {
      await localSaveSettings({ stockTickers: updated });
    }
  }, [dispatch, uid, tickerInput, settings.stockTickers, storageMode]);

  /** 종목 삭제 */
  const handleRemoveTicker = useCallback(
    async (ticker: string) => {
      const updated = settings.stockTickers.filter((t) => t !== ticker);
      dispatch(setStockTickers(updated));
      if (storageMode === 'firebase' && uid) {
        await updateUserSettings(uid, { stockTickers: updated } as any).catch(showError);
      } else {
        await localSaveSettings({ stockTickers: updated });
      }
    },
    [dispatch, uid, settings.stockTickers, storageMode],
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
    if (storageMode === 'firebase' && uid) {
      await updateUserSettings(uid, { newsKeywords: updated } as any).catch(showError);
    } else {
      await localSaveSettings({ newsKeywords: updated });
    }
  }, [dispatch, uid, keywordInput, settings.newsKeywords, storageMode]);

  /** 뉴스 키워드 삭제 */
  const handleRemoveKeyword = useCallback(
    async (kw: string) => {
      const updated = settings.newsKeywords.filter((k) => k !== kw);
      dispatch(setNewsKeywords(updated));
      if (storageMode === 'firebase' && uid) {
        await updateUserSettings(uid, { newsKeywords: updated } as any).catch(showError);
      } else {
        await localSaveSettings({ newsKeywords: updated });
      }
    },
    [dispatch, uid, settings.newsKeywords, storageMode],
  );

  /** 저장 모드 전환: local → firebase (로그인하여 백업) */
  const handleSwitchToFirebase = useCallback(async () => {
    setIsMigrating(true);
    try {
      const user = await signInAnon();
      await setStorageMode('firebase');
      dispatch(setMode('firebase'));

      // 로컬 데이터 마이그레이션
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 저장 모드 */}
        <Card>
          <Text style={styles.rowTitle}>저장 모드</Text>
          <Text style={styles.rowDesc}>
            {storageMode === 'firebase' ? '로그인 백업 사용 중' : '로컬 저장 모드'}
          </Text>
          <View style={styles.modeActions}>
            {storageMode === 'local' ? (
              <TouchableOpacity
                style={styles.modeBtn}
                onPress={handleSwitchToFirebase}
                disabled={isMigrating}
              >
                <Text style={styles.modeBtnText}>
                  {isMigrating ? '전환 중...' : '로그인하여 백업 사용'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.modeBtnOutline} onPress={handleSwitchToLocal}>
                <Text style={styles.modeBtnOutlineText}>로컬 모드로 전환</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* 알림 */}
        <Card>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>푸시 알림</Text>
              <Text style={styles.rowDesc}>일정 알림을 받습니다</Text>
            </View>
            <Switch
              value={settings.pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>
        </Card>

        {/* 일일 브리핑 */}
        <Card>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>일일 브리핑</Text>
              <Text style={styles.rowDesc}>매일 선택한 항목을 브리핑합니다</Text>
            </View>
            <Switch
              value={settings.dailyBriefingEnabled}
              onValueChange={handleBriefingToggle}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>

          {settings.dailyBriefingEnabled && (
            <View style={styles.timeSelector}>
              <Text style={styles.timeLabel}>알림 시간</Text>
              <View style={styles.timeOptions}>
                {BRIEFING_HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.timeChip,
                      settings.dailyBriefingTime.hour === h && styles.timeChipActive,
                    ]}
                    onPress={() => handleBriefingHour(h)}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        settings.dailyBriefingTime.hour === h && styles.timeChipTextActive,
                      ]}
                    >
                      {h}시
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* 브리핑 항목 설정 */}
        <Card>
          <Text style={styles.sectionTitle}>브리핑 항목</Text>

          <View style={styles.row}>
            <Text style={styles.rowTitle}>날씨</Text>
            <Switch
              value={settings.digestTypes.weather}
              onValueChange={(v) => handleDigestTypeToggle('weather', v)}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>

          {settings.digestTypes.weather && (
            <View style={styles.inlineInput}>
              <TextInput
                style={styles.textInput}
                placeholder="도시 (예: Seoul)"
                placeholderTextColor="#BBB"
                value={cityInput}
                onChangeText={setCityInput}
                onBlur={handleSaveCity}
                returnKeyType="done"
                onSubmitEditing={handleSaveCity}
              />
            </View>
          )}

          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={styles.rowTitle}>주식</Text>
            <Switch
              value={settings.digestTypes.stocks}
              onValueChange={(v) => handleDigestTypeToggle('stocks', v)}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>

          {settings.digestTypes.stocks && (
            <View style={styles.tickerSection}>
              <View style={styles.inlineInput}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="종목 코드 (예: AAPL)"
                  placeholderTextColor="#BBB"
                  value={tickerInput}
                  onChangeText={setTickerInput}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleAddTicker}
                />
                <TouchableOpacity style={styles.addChip} onPress={handleAddTicker}>
                  <Text style={styles.addChipText}>추가</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipRow}>
                {settings.stockTickers.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.chip}
                    onPress={() => handleRemoveTicker(t)}
                  >
                    <Text style={styles.chipText}>{t} x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={styles.rowTitle}>주요 뉴스</Text>
            <Switch
              value={settings.digestTypes.news}
              onValueChange={(v) => handleDigestTypeToggle('news', v)}
              trackColor={{ true: '#4A90D9' }}
            />
          </View>

          {settings.digestTypes.news && (
            <View style={styles.tickerSection}>
              <View style={styles.inlineInput}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="키워드 (선택)"
                  placeholderTextColor="#BBB"
                  value={keywordInput}
                  onChangeText={setKeywordInput}
                  returnKeyType="done"
                  onSubmitEditing={handleAddKeyword}
                />
                <TouchableOpacity style={styles.addChip} onPress={handleAddKeyword}>
                  <Text style={styles.addChipText}>추가</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipRow}>
                {settings.newsKeywords.map((kw) => (
                  <TouchableOpacity
                    key={kw}
                    style={styles.chip}
                    onPress={() => handleRemoveKeyword(kw)}
                  >
                    <Text style={styles.chipText}>{kw} x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* 계정 정보 */}
        <Card>
          <Text style={styles.rowTitle}>계정</Text>
          <Text style={styles.infoText}>
            {storageMode === 'firebase' && uid
              ? `UID: ${uid.slice(0, 12)}...`
              : '로컬 모드'}
          </Text>
          <Text style={styles.infoText}>타임존: {settings.timezone}</Text>
        </Card>

        {/* 앱 정보 */}
        <Card>
          <Text style={styles.rowTitle}>앱 정보</Text>
          <Text style={styles.infoText}>Push Office v1.0.0</Text>
          <Text style={styles.infoText}>Expo + Firebase</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingVertical: 12 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 2 },
  rowDesc: { fontSize: 12, color: '#888' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 12 },

  timeSelector: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  timeLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  timeOptions: { flexDirection: 'row', gap: 8 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  timeChipActive: { backgroundColor: '#4A90D9' },
  timeChipText: { fontSize: 13, color: '#666' },
  timeChipTextActive: { color: '#FFF', fontWeight: '600' },

  infoText: { fontSize: 13, color: '#888', marginTop: 4 },

  inlineInput: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },

  tickerSection: { marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 13, color: '#4A90D9' },
  addChip: {
    marginLeft: 8,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChipText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  modeActions: { marginTop: 10 },
  modeBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  modeBtnOutline: {
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnOutlineText: { color: '#4A90D9', fontSize: 14, fontWeight: '600' },
});
