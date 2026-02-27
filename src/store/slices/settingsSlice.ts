import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getUserTimezone } from '../../lib/time';
import type { UserSettings } from '../../types';

const initialState: UserSettings = {
  timezone: getUserTimezone(),
  pushEnabled: true,
  dailyBriefingEnabled: false,
  dailyBriefingTime: { hour: 8, minute: 0 },
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
  },
});

export const { updateSettings, setPushEnabled, setDailyBriefing } = settingsSlice.actions;
export default settingsSlice.reducer;
