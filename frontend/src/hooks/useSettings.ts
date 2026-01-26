import type { AppDispatch, RootState } from "@/store";
import type { FocusRelations } from "@/store/settingsSlice";
import {
  resetSettings,
  setFocusMode,
  setLanguage,
  toggleFocusRelation,
} from "@/store/settingsSlice";
import { useDispatch, useSelector } from "react-redux";

export function useSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => s.settings);

  const actions = {
    setFocusMode: (enabled: boolean) => dispatch(setFocusMode(enabled)),
    toggleFocusRelation: (key: keyof FocusRelations) =>
      dispatch(toggleFocusRelation(key)),
    setLanguage: (lang: string) => dispatch(setLanguage(lang)),
    resetSettings: () => dispatch(resetSettings()),
  };

  return { state, actions };
}
