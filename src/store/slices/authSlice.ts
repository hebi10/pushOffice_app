import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  uid: string | null;
  isAnonymous: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  uid: null,
  isAnonymous: true,
  isLoading: true,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<{ uid: string; isAnonymous: boolean }>) {
      state.uid = action.payload.uid;
      state.isAnonymous = action.payload.isAnonymous;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    clearUser(state) {
      state.uid = null;
      state.isAnonymous = true;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = authSlice.actions;
export default authSlice.reducer;
