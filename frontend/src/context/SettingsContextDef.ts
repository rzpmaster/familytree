import { createContext, Dispatch } from 'react';

// --- Types ---

export interface FocusRelations {
  self: boolean;
  father: boolean;
  mother: boolean;
  spouse: boolean;
  son: boolean;
  daughter: boolean;
}

export interface SettingsState {
  focusModeEnabled: boolean;
  focusRelations: FocusRelations;
  language: string;
}

export type Action =
  | { type: 'SET_FOCUS_MODE'; payload: boolean }
  | { type: 'TOGGLE_FOCUS_RELATION'; payload: keyof FocusRelations }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'RESET_SETTINGS' };

export interface SettingsContextType {
  state: SettingsState;
  dispatch: Dispatch<Action>;
  actions: {
    setFocusMode: (enabled: boolean) => void;
    toggleFocusRelation: (key: keyof FocusRelations) => void;
    setLanguage: (lang: string) => void;
  };
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
