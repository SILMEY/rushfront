import "./style.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";

// Lire tr_token AVANT que le router (et son beforeEach) s'initialise.
// Le token OAuth cross-domaine arrive dans l'URL après le redirect Google/Discord.
// Si on attend onMounted d'App.vue, le beforeEach a déjà appelé fetchMe() sans token.
const _trTokenUrl = new URL(window.location.href);
const _trToken = _trTokenUrl.searchParams.get("tr_token");
if (_trToken) {
  localStorage.setItem("tr_access_token", _trToken);
  _trTokenUrl.searchParams.delete("tr_token");
  window.history.replaceState({}, "", _trTokenUrl.toString());
}

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");

