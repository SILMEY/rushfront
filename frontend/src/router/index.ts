import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import LoginPage from "../pages/LoginPage.vue";
import HomePage from "../pages/HomePage.vue";
import LobbyPage from "../pages/LobbyPage.vue";
import GamePage from "../pages/GamePage.vue";
import ProfilePage from "../pages/ProfilePage.vue";
import LeaderboardPage from "../pages/LeaderboardPage.vue";
import PrivacyPage from "../pages/PrivacyPage.vue";
import SupportPage from "../pages/SupportPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/login",       component: LoginPage },
    { path: "/",            component: HomePage },
    { path: "/leaderboard", component: LeaderboardPage },
    { path: "/privacy",     component: PrivacyPage },
    { path: "/support",     component: SupportPage },
    { path: "/profile",     component: ProfilePage },
    { path: "/lobby/:id",   component: LobbyPage, props: true },
    { path: "/game/:id",    component: GamePage,  props: true }
  ]
});

const PUBLIC_PATHS = ["/", "/login", "/leaderboard", "/privacy"];

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();
  if (!auth.user && !PUBLIC_PATHS.includes(to.path)) return "/login";
  if (auth.user && to.path === "/login") return "/";
  return true;
});
