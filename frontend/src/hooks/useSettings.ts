import type { AppDispatch, RootState } from "@/store";
import type { FocusRelations } from "@/store/settingsSlice";
import {
  resetSettings,
  setCompactMode,
  setDeveloperMode,
  setDimDeceased,
  setDimUnborn,
  setFocusMode,
  setLanguage,
  setPrivacyMode,
  setShowDeceased,
  setShowLiving,
  setShowNotLiving,
  setShowSpouses,
  setShowUnborn,
  setTimelineEnabled,
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
    setPrivacyMode: (enabled: boolean) => dispatch(setPrivacyMode(enabled)),

    setShowLiving: (enabled: boolean) => dispatch(setShowLiving(enabled)),
    setShowNotLiving: (enabled: boolean) => dispatch(setShowNotLiving(enabled)),
    setShowDeceased: (enabled: boolean) => dispatch(setShowDeceased(enabled)),
    setDimDeceased: (enabled: boolean) => dispatch(setDimDeceased(enabled)),
    setShowUnborn: (enabled: boolean) => dispatch(setShowUnborn(enabled)),
    setDimUnborn: (enabled: boolean) => dispatch(setDimUnborn(enabled)),
    setShowSpouses: (enabled: boolean) => dispatch(setShowSpouses(enabled)),

    setTimelineEnabled: (enabled: boolean) =>
      dispatch(setTimelineEnabled(enabled)),
    setCompactMode: (enabled: boolean) => dispatch(setCompactMode(enabled)),
    setDeveloperMode: (enabled: boolean) => dispatch(setDeveloperMode(enabled)),
    resetSettings: () => dispatch(resetSettings()),
  };

  return { state, actions };
}
