import i18n from "@/i18n/config";
import type { RootState } from "@/store";
import { useEffect } from "react";
import { useSelector } from "react-redux";

export default function I18nSync() {
  const language = useSelector((s: RootState) => s.settings.language);

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  return null;
}
