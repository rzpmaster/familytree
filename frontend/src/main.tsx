import { persistor, store } from "@/store";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import { loadConfig } from "./config/constants";
import "./i18n/config";
import I18nSync from "./i18n/I18nSync";
import "./index.css";
import { initAuth } from "./store/authSlice";

// Load config before rendering
loadConfig().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Provider store={store}>
        <PersistGate
          loading={null}
          persistor={persistor}
          onBeforeLift={() => {
            store.dispatch(initAuth());
          }}
        >
          <I18nSync />
          <App />
        </PersistGate>
      </Provider>
    </StrictMode>,
  );
});
