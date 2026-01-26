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

    resetSettings(state) {
      state.focusModeEnabled = true;
      state.focusRelations = defaultFocusRelations;
      state.language = "zh";
    },
  },
});

export const { setFocusMode, toggleFocusRelation, setLanguage, resetSettings } =
  settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
