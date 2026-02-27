import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StorageMode } from '../../types';

interface StorageModeState {
  mode: StorageMode;
  deviceKey: string | null;
}

const initialState: StorageModeState = {
  mode: 'firebase',
  deviceKey: null,
};

const storageModeSlice = createSlice({
  name: 'storageMode',
  initialState,
  reducers: {
    setMode(state, action: PayloadAction<StorageMode>) {
      state.mode = action.payload;
    },
    setDeviceKey(state, action: PayloadAction<string>) {
      state.deviceKey = action.payload;
    },
  },
});

export const { setMode, setDeviceKey } = storageModeSlice.actions;
export default storageModeSlice.reducer;
