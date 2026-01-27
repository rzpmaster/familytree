import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import { authReducer } from "./authSlice";
import { familyReducer } from "./familySlice";
import { settingsReducer } from "./settingsSlice";

const authPersistConfig = {
  key: "auth",
  storage,
  whitelist: ["user"],
};

const familyPersistConfig = {
  key: "family",
  storage,
  whitelist: ["lastSelectedFamilyId", "selectedNodeIds"],
};

const settingsPersistConfig = {
  key: "settings",
  storage,
  whitelist: ["focusModeEnabled", "focusRelations", "language"],
};

const rootPersistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "family", "settings"],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  family: persistReducer(familyPersistConfig, familyReducer),
  settings: persistReducer(settingsPersistConfig, settingsReducer),
});

export const store = configureStore({
  reducer: persistReducer(rootPersistConfig, rootReducer),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
