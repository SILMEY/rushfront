import { createI18n } from "vue-i18n";
import fr from "./locales/fr";
import en from "./locales/en";
import es from "./locales/es";
import de from "./locales/de";

export type Locale = "fr" | "en" | "es" | "de";
const VALID: Locale[] = ["fr", "en", "es", "de"];

const saved = localStorage.getItem("lang") as Locale | null;

function detectBrowserLocale(): Locale {
  const langs = navigator.languages ?? [navigator.language];
  for (const l of langs) {
    const code = l.split("-")[0]?.toLowerCase() as Locale;
    if (VALID.includes(code)) return code;
  }
  return "fr";
}

const locale: Locale = saved && VALID.includes(saved) ? saved : detectBrowserLocale();

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
