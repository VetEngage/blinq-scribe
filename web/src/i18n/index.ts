import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  // React escapes every string it renders, so i18next must not escape a second time.
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
export const t = i18n.t.bind(i18n);
