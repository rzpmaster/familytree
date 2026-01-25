import i18n from '@/i18n/config';
import React, { ReactNode, useEffect, useReducer } from 'react';
import { Action, FocusRelations, SettingsContext, SettingsState } from './SettingsContextDef';

// --- Initial State ---

const defaultFocusRelations: FocusRelations = {
  self: true,
  father: true,
  mother: true,
  spouse: true,
  son: true,
  daughter: true,
};

const getInitialState = (): SettingsState => {
  const savedFocusMode = localStorage.getItem('focusModeEnabled');
  const savedFocusRelations = localStorage.getItem('focusRelations');
  // Default to 'zh' (Chinese) if no language saved
  const savedLanguage = localStorage.getItem('i18nextLng') || 'zh';

  return {
    focusModeEnabled: savedFocusMode !== null ? JSON.parse(savedFocusMode) : true,
    focusRelations: savedFocusRelations ? JSON.parse(savedFocusRelations) : defaultFocusRelations,
    language: savedLanguage,
  };
};

// --- Reducer ---

const settingsReducer = (state: SettingsState, action: Action): SettingsState => {
  switch (action.type) {
    case 'SET_FOCUS_MODE':
      return { ...state, focusModeEnabled: action.payload };
      
    case 'TOGGLE_FOCUS_RELATION': {
      const key = action.payload;
      // Prevent toggling 'self' off
      if (key === 'self') return state;
      
      return {
        ...state,
        focusRelations: {
          ...state.focusRelations,
          [key]: !state.focusRelations[key],
        },
      };
    }

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };

    case 'RESET_SETTINGS':
      return {
        focusModeEnabled: true,
        focusRelations: defaultFocusRelations,
        language: 'zh',
      };

    default:
      return state;
  }
};

// --- Provider ---

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(settingsReducer, undefined, getInitialState);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('focusModeEnabled', JSON.stringify(state.focusModeEnabled));
  }, [state.focusModeEnabled]);

  useEffect(() => {
    localStorage.setItem('focusRelations', JSON.stringify(state.focusRelations));
  }, [state.focusRelations]);

  useEffect(() => {
    // Sync i18n when language changes in state
    if (i18n.language !== state.language) {
      i18n.changeLanguage(state.language);
    }
  }, [state.language]);

  // Helper actions for cleaner usage
  const actions = {
    setFocusMode: (enabled: boolean) => dispatch({ type: 'SET_FOCUS_MODE', payload: enabled }),
    toggleFocusRelation: (key: keyof FocusRelations) => dispatch({ type: 'TOGGLE_FOCUS_RELATION', payload: key }),
    setLanguage: (lang: string) => dispatch({ type: 'SET_LANGUAGE', payload: lang }),
  };

  return (
    <SettingsContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </SettingsContext.Provider>
  );
};
