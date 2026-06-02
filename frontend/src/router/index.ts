import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import LoginPage from "../pages/LoginPage.vue";
import HomePage from "../pages/HomePage.vue";
import LobbyPage from "../pages/LobbyPage.vue";
import GamePage from "../pages/GamePage.vue";
import ProfilePage from "../pages/ProfilePage.vue";
import LeaderboardPage from "../pages/LeaderboardPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginPage },
    { path: "/", component: HomePage },
    { path: "/leaderboard", component: LeaderboardPage },
    { path: "/profile", component: ProfilePage },
    { path: "/lobby/:id", component: LobbyPage, props: true },
    { path: "/game/:id", component: GamePage, props: true }
  ]
});

const PUBLIC_PATHS = ["/", "/login", "/leaderboard"];

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();
  if (!auth.user && !PUBLIC_PATHS.includes(to.path)) return "/login";
  if (auth.user && to.path === "/login") return "/";
  return true;
});
