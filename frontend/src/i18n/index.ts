import { createI18n } from "vue-i18n";
import fr from "./locales/fr";
import en from "./locales/en";

const saved = localStorage.getItem("lang");
const locale = (saved === "en" || saved === "fr") ? saved : "fr";

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "fr",
  messages: { fr, en },
});

export type Locale = "fr" | "en";

export function setLocale(lang: Locale) {
  i18n.global.locale.value = lang;
  localStorage.setItem("lang", lang);
  document.documentElement.setAttribute("lang", lang);
}

export function getLocale(): Locale {
  return i18n.global.locale.value as Locale;
}
