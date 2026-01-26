/* eslint-disable @typescript-eslint/no-explicit-any */
import { getUser, loginUser, registerUser } from "@/services/api";
import type { User } from "@/types";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  isLoading: false,
  error: null,
};

/**
 * 启动初始化：
 * - 如果 persist 已经恢复了 user，则用 user.id 去后端 refresh，拿最新 roles
 * - 如果没有 user，直接结束
 */
export const initAuth = createAsyncThunk<User | null, void, { state: any }>(
  "auth/initAuth",
  async (_: void, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const existingUser: User | null = state.auth?.user ?? null;

      if (!existingUser?.id) return null;

      // refresh user data from backend
      const freshUser = await getUser(existingUser.id);
      return freshUser;
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "initAuth failed");
    }
  },
);

export const login = createAsyncThunk<
  User,
  { email: string; password?: string }
>("auth/login", async ({ email, password }, { rejectWithValue }) => {
  try {
    const userData = await loginUser(email, password || "password");
    return userData;
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "login failed");
  }
});

export const register = createAsyncThunk<
  void,
  { email: string; name: string; password?: string }
>(
  "auth/register",
  async ({ email, name, password }, { dispatch, rejectWithValue }) => {
    try {
      await registerUser(email, name, password || "password");
      // Auto login after register
      await dispatch(login({ email, password })).unwrap();
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "register failed");
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.error = null;
      state.isLoading = false;
    },
    // 可选：如果你有地方需要手动更新 user（例如修改 profile）
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // initAuth
      .addCase(initAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        // 如果有 freshUser 就覆盖；没有就保持现状（比如还没登录）
        if (action.payload) state.user = action.payload;
      })
      .addCase(initAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = String(action.payload ?? action.error.message ?? "");
        // 这里保持“失败不强制登出”的策略（跟你原来一致）
      })

      // login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = String(action.payload ?? action.error.message ?? "");
      })

      // register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = String(action.payload ?? action.error.message ?? "");
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export const authReducer = authSlice.reducer;
