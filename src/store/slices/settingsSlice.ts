import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getUserTimezone } from '../../lib/time';
import type { DigestTypes, UserSettings } from '../../types';

const initialState: UserSettings = {
  timezone: getUserTimezone(),
  pushEnabled: true,
  dailyBriefingEnabled: false,
  dailyBriefingTime: { hour: 8, minute: 0 },
  digestTypes: { weather: true, stocks: false, news: false },
  digestCity: 'Seoul',
  stockTickers: [],
  newsLanguage: 'ko',
  newsKeywords: [],
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettings(state, action: PayloadAction<Partial<UserSettings>>) {
      return { ...state, ...action.payload };
    },
    setPushEnabled(state, action: PayloadAction<boolean>) {
      state.pushEnabled = action.payload;
    },
    setDailyBriefing(
      state,
      action: PayloadAction<{ enabled: boolean; hour?: number; minute?: number }>,
    ) {
      state.dailyBriefingEnabled = action.payload.enabled;
      if (action.payload.hour !== undefined) state.dailyBriefingTime.hour = action.payload.hour;
      if (action.payload.minute !== undefined) state.dailyBriefingTime.minute = action.payload.minute;
    },
    setDigestTypes(state, action: PayloadAction<Partial<DigestTypes>>) {
      state.digestTypes = { ...state.digestTypes, ...action.payload };
    },
    setDigestCity(state, action: PayloadAction<string>) {
      state.digestCity = action.payload;
    },
    setStockTickers(state, action: PayloadAction<string[]>) {
      state.stockTickers = action.payload.slice(0, 5);
    },
    setNewsLanguage(state, action: PayloadAction<string>) {
      state.newsLanguage = action.payload;
    },
    setNewsKeywords(state, action: PayloadAction<string[]>) {
      state.newsKeywords = action.payload;
    },
  },
});

export const {
  updateSettings,
  setPushEnabled,
  setDailyBriefing,
  setDigestTypes,
  setDigestCity,
  setStockTickers,
  setNewsLanguage,
  setNewsKeywords,
} = settingsSlice.actions;
export default settingsSlice.reducer;
