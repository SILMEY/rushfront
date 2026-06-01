import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import LoginPage from "../pages/LoginPage.vue";
import HomePage from "../pages/HomePage.vue";
import LobbyPage from "../pages/LobbyPage.vue";
import GamePage from "../pages/GamePage.vue";
import ProfilePage from "../pages/ProfilePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginPage },
    { path: "/", component: HomePage },
    { path: "/profile", component: ProfilePage },
    { path: "/lobby/:id", component: LobbyPage, props: true },
    { path: "/game/:id", component: GamePage, props: true }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();
  if (!auth.user && to.path !== "/login") return "/login";
  if (auth.user && to.path === "/login") return "/";
  return true;
});
