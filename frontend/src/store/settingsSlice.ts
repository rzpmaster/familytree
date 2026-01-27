import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type FocusRelations = {
  self: boolean;
  father: boolean;
  mother: boolean;
  spouse: boolean;
  son: boolean;
  daughter: boolean;
};

export type SettingsState = {
  focusModeEnabled: boolean;
  focusRelations: FocusRelations;
  language: string; // "zh" | "en" ...
  privacyMode: boolean; // 隐私模式（只显姓）

  // 显示模式控制
  showLiving: boolean; // 显示在世
  showNotLiving: boolean; // 显示不在世（总开关）

  // 不在世细分
  showDeceased: boolean; // 显示已逝世
  dimDeceased: boolean; // 淡显已逝世
  showUnborn: boolean; // 显示未出生
  dimUnborn: boolean; // 淡显未出生

  timelineEnabled: boolean; // 是否启用时间线
  timelineYear: number | null; // 时间线当前年份 (null 表示使用当前时间)
  compactMode: boolean; // 紧凑模式
};

export const defaultFocusRelations: FocusRelations = {
  self: true,
  father: true,
  mother: true,
  spouse: true,
  son: true,
  daughter: true,
};

const initialState: SettingsState = {
  focusModeEnabled: true,
  focusRelations: defaultFocusRelations,
  language: "zh",
  privacyMode: false,

  showLiving: true,
  showNotLiving: true,
  showDeceased: true,
  dimDeceased: false,
  showUnborn: true,
  dimUnborn: false,

  timelineEnabled: false,
  timelineYear: null,
  compactMode: false,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setFocusMode(state, action: PayloadAction<boolean>) {
      state.focusModeEnabled = action.payload;
    },

    toggleFocusRelation(state, action: PayloadAction<keyof FocusRelations>) {
      const key = action.payload;
      if (key === "self") return; // 保持你原来的规则：self 不允许关

      state.focusRelations[key] = !state.focusRelations[key];
    },

    setLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
    },

    setPrivacyMode(state, action: PayloadAction<boolean>) {
      state.privacyMode = action.payload;
    },

    setShowLiving(state, action: PayloadAction<boolean>) {
      state.showLiving = action.payload;
    },
    setShowNotLiving(state, action: PayloadAction<boolean>) {
      state.showNotLiving = action.payload;
    },
    setShowDeceased(state, action: PayloadAction<boolean>) {
      state.showDeceased = action.payload;
    },
    setDimDeceased(state, action: PayloadAction<boolean>) {
      state.dimDeceased = action.payload;
    },
    setShowUnborn(state, action: PayloadAction<boolean>) {
      state.showUnborn = action.payload;
    },
    setDimUnborn(state, action: PayloadAction<boolean>) {
      state.dimUnborn = action.payload;
    },

    setTimelineEnabled(state, action: PayloadAction<boolean>) {
      state.timelineEnabled = action.payload;
    },

    setTimelineYear(state, action: PayloadAction<number | null>) {
      state.timelineYear = action.payload;
    },

    setCompactMode(state, action: PayloadAction<boolean>) {
      state.compactMode = action.payload;
    },

    resetSettings(state) {
      state.focusModeEnabled = true;
      state.focusRelations = defaultFocusRelations;
      state.language = "zh";
      state.privacyMode = false;
      state.showDeceased = true;
      state.timelineEnabled = false;
      state.compactMode = false;
    },
  },
});

export const {
  setFocusMode,
  toggleFocusRelation,
  setLanguage,
  setPrivacyMode,
  setShowLiving,
  setShowNotLiving,
  setShowDeceased,
  setDimDeceased,
  setShowUnborn,
  setDimUnborn,
  setTimelineEnabled,
  setTimelineYear,
  setCompactMode,
  resetSettings,
} = settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
