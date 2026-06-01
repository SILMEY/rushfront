<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
const displayName = computed(() => auth.displayName);
const initials = computed(() => displayName.value.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase());
const router = useRouter();
function openProfile() {
  router.push("/profile");
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-900">
    <header class="sticky top-0 z-10 border-b border-white/10 bg-zinc-900/60 backdrop-blur">
      <div class="flex h-14 w-full items-center justify-between px-4 lg:px-6">
        <div class="flex items-center gap-3">
          <img
            src="/rushfront-logo.svg"
            class="h-8 w-8 rounded ring-1 ring-white/10"
            alt="Rushfront"
          />
          <div class="font-semibold tracking-wide text-amber-300">Rushfront</div>
        </div>
        <div v-if="auth.user" class="flex items-center gap-3">
          <button class="rounded-full ring-1 ring-white/10 hover:ring-white/20" @click="openProfile()" title="Profil">
            <img v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" class="h-8 w-8 rounded-full" />
            <div v-else class="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs">
              {{ initials }}
            </div>
          </button>
          <button class="hidden text-sm text-slate-200 hover:underline sm:block" @click="openProfile()">{{ displayName }}</button>
          <button
            class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10"
            @click="auth.logout()"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
    <main class="w-full px-4 py-6 lg:px-6">
      <slot />
    </main>
  </div>
</template>
