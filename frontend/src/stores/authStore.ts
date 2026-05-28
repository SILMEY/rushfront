import { defineStore } from "pinia";
import { apiFetch, apiOrigin } from "../api/http";
import type { User } from "../types/user";
import { disconnectSocket } from "../composables/useSocket";

let fetchMePromise: Promise<void> | null = null;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as User | null,
    ready: false,
    loading: false
  }),
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
    loginWithGoogle() {
      window.location.href = `${apiOrigin()}/auth/google/start`;
    },
    async logout() {
      await apiFetch("/auth/logout", { method: "POST" });
      this.user = null;
      disconnectSocket();
      window.location.href = "/login";
    }
  }
});
