<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
const router = useRouter();

const displayName = computed(() => auth.displayName);
const initials = computed(() => displayName.value.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase());

const mobileMenuOpen = ref(false);

function navigate(path: string) {
  router.push(path);
  mobileMenuOpen.value = false;
}
</script>

<template>
  <nav
    class="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#4d4635] bg-stone-900/90 px-4 md:px-6 backdrop-blur-md"
    role="navigation"
    aria-label="Navigation principale"
  >
    <button
      class="flex items-center gap-3"
      aria-label="Retour à l'accueil"
      @click="navigate('/')"
    >
      <span class="font-headline text-xl md:text-2xl font-bold tracking-widest text-[#d4af37]">FRONTRUSH</span>
    </button>

    <!-- Navigation desktop (centrée) -->
    <div class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
      <button
        class="font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] transition-colors duration-200 hover:text-[#d4af37]"
        @click="navigate('/')"
      >
        GAMES
      </button>
      <button
        class="font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] transition-colors duration-200 hover:text-[#d4af37]"
        @click="navigate('/leaderboard')"
      >
        LEADERBOARDS
      </button>
    </div>

    <div class="flex items-center gap-2 md:gap-4">
      <!-- Profil (toujours visible) -->
      <button
        class="text-[#d4c59f] transition-all hover:text-[#d4af37] active:scale-95"
        aria-label="Mon profil"
        @click="navigate('/profile')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">account_circle</span>
      </button>

      <!-- Logout desktop -->
      <button
        v-if="auth.user"
        class="hidden items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#d4c59f] ring-1 ring-white/10 hover:bg-white/10 md:flex"
        @click="auth.logout()"
      >
        <span class="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px]" aria-hidden="true">{{ initials }}</span>
        Logout
      </button>
      <button
        v-else
        class="hidden items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#d4af37] transition hover:bg-[#d4af37]/20 md:flex"
        @click="navigate('/login')"
      >
        Se connecter
      </button>

      <!-- Hamburger mobile -->
      <button
        class="flex h-9 w-9 items-center justify-center rounded-md border border-[#4d4635] bg-black/20 text-[#d4c59f] transition hover:text-[#d4af37] md:hidden"
        :aria-expanded="mobileMenuOpen"
        aria-label="Menu"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ mobileMenuOpen ? 'close' : 'menu' }}</span>
      </button>
    </div>
  </nav>

  <!-- Menu mobile déroulant -->
  <Transition name="slide-down">
    <div
      v-if="mobileMenuOpen"
      class="fixed top-16 left-0 right-0 z-[49] border-b border-[#4d4635] bg-stone-900/98 backdrop-blur-md md:hidden"
      role="menu"
    >
      <div class="flex flex-col py-2">
        <button
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] hover:bg-white/5 hover:text-[#d4af37] transition"
          role="menuitem"
          @click="navigate('/')"
        >
          Games
        </button>
        <button
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] hover:bg-white/5 hover:text-[#d4af37] transition"
          role="menuitem"
          @click="navigate('/leaderboard')"
        >
          Leaderboards
        </button>
        <div class="mx-6 my-1 h-px bg-white/10"></div>
        <button
          v-if="auth.user"
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-red-400/70 hover:bg-white/5 hover:text-red-400 transition"
          role="menuitem"
          @click="auth.logout(); mobileMenuOpen = false"
        >
          Déconnexion
        </button>
        <button
          v-else
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-[#d4af37] hover:bg-white/5 transition"
          role="menuitem"
          @click="navigate('/login')"
        >
          Se connecter
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
