import { defineStore } from "pinia";
import { apiFetch, apiOrigin } from "../api/http";
import type { User } from "../types/user";
import { disconnectSocket } from "../composables/useSocket";

let fetchMePromise: Promise<void> | null = null;
const TOKEN_KEY = "tr_access_token";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as User | null,
    ready: false,
    loading: false,
    accessToken: (localStorage.getItem(TOKEN_KEY) as string | null) ?? null
  }),
  getters: {
    displayName(state) {
      return state.user?.pseudo?.trim() || state.user?.name || "";
    }
  },
  actions: {
    async fetchMe() {
      if (fetchMePromise) return fetchMePromise;
      this.loading = true;
      fetchMePromise = (async () => {
        try {
          const res = await apiFetch<{ user: User | null }>("/auth/me");
          this.user = res.user;
        } finally {
          this.ready = true;
          this.loading = false;
          fetchMePromise = null;
        }
      })();
      return fetchMePromise;
    },
    setAccessToken(token: string | null) {
      this.accessToken = token;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    },
    loginWithGoogle() {
      window.location.href = `${apiOrigin()}/auth/google/start`;
    },
    async logout() {
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } catch {
        // Even if the API call fails (expired session, network error), we still want to clear local auth state.
      } finally {
        this.setAccessToken(null);
        this.user = null;
        disconnectSocket();
        const base = (import.meta.env.BASE_URL as string) || "/";
        window.location.assign(`${base.replace(/\/+$/, "/")}login`);
      }
    },
    async setPseudo(pseudo: string) {
      const res = await apiFetch<{ user: User }>("/profile/pseudo", {
        method: "PUT",
        body: JSON.stringify({ pseudo })
      });
      this.user = res.user;
    }
  }
});
