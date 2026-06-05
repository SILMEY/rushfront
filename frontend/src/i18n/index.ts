import { createI18n } from "vue-i18n";
import fr from "./locales/fr";
import en from "./locales/en";
import es from "./locales/es";
import de from "./locales/de";

export type Locale = "fr" | "en" | "es" | "de";
const VALID: Locale[] = ["fr", "en", "es", "de"];

const saved = localStorage.getItem("lang") as Locale | null;
const locale: Locale = saved && VALID.includes(saved) ? saved : "fr";

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "fr",
  messages: { fr, en, es, de },
});

export function setLocale(lang: Locale) {
  i18n.global.locale.value = lang;
  localStorage.setItem("lang", lang);
  document.documentElement.setAttribute("lang", lang);
}

export function getLocale(): Locale {
  return i18n.global.locale.value as Locale;
}
