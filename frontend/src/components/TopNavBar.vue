<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
const router = useRouter();

const displayName = computed(() => auth.displayName);
const initials = computed(() => displayName.value.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase());
</script>

<template>
  <nav
    class="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#4d4635] bg-stone-900/90 px-6 backdrop-blur-md"
  >
    <button class="flex items-center gap-3" @click="router.push('/')">
      <img src="/rushfront-logo.svg" class="h-9 w-9 rounded ring-1 ring-white/10" alt="Rushfront" />
      <span class="font-headline text-2xl font-bold tracking-widest text-[#d4af37]">RUSHFRONT</span>
    </button>

    <div class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
      <button
        class="font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] transition-colors duration-200 hover:text-[#d4af37]"
        @click="router.push('/')"
      >
        GAMES
      </button>
      <button
        class="font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] transition-colors duration-200 hover:text-[#d4af37]"
        @click="router.push('/')"
      >
        LEADERBOARDS
      </button>
    </div>

    <div class="flex items-center gap-4">
      <button class="text-[#d4c59f] transition-all hover:text-[#d4af37] active:scale-95" title="Défense">
        <span class="material-symbols-outlined" aria-hidden="true">shield</span>
      </button>

      <button
        class="text-[#d4c59f] transition-all hover:text-[#d4af37] active:scale-95"
        title="Profil"
        @click="router.push('/profile')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">account_circle</span>
      </button>

      <button
        v-if="auth.user"
        class="hidden items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#d4c59f] ring-1 ring-white/10 hover:bg-white/10 md:flex"
        @click="auth.logout()"
      >
        <span class="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px]">{{ initials }}</span>
        Logout
      </button>
    </div>
  </nav>
</template>

