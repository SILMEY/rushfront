<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
const initials = computed(() => auth.user?.name?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase());
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
    <header class="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/60 backdrop-blur">
      <div class="flex h-14 w-full items-center justify-between px-4 lg:px-6">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded bg-emerald-500/15 ring-1 ring-emerald-500/30"></div>
          <div class="font-semibold tracking-wide text-emerald-200">Rushfront</div>
        </div>
        <div v-if="auth.user" class="flex items-center gap-3">
          <img v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" class="h-8 w-8 rounded-full ring-1 ring-white/10" />
          <div v-else class="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs">
            {{ initials }}
          </div>
          <div class="hidden text-sm text-slate-200 sm:block">{{ auth.user.name }}</div>
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
