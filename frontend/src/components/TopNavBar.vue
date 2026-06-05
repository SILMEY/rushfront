<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { useI18n } from "vue-i18n";
import { setLocale, getLocale, type Locale } from "../i18n";

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const displayName = computed(() => auth.displayName);
const initials = computed(() => displayName.value.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase());

const mobileMenuOpen = ref(false);

const currentLocale = ref<Locale>(getLocale());

const LOCALES: { code: Locale; flag: string; label: string }[] = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

function switchLocale() {
  const next: Locale = currentLocale.value === "fr" ? "en" : "fr";
  setLocale(next);
  currentLocale.value = next;
}

function navigate(path: string) {
  router.push(path);
  mobileMenuOpen.value = false;
}
</script>

<template>
  <nav
    class="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#4d4635] bg-stone-900/90 px-4 md:px-6 backdrop-blur-md"
    role="navigation"
    :aria-label="t('nav.menu')"
  >
    <button
      class="flex items-center gap-3"
      :aria-label="t('nav.brand')"
      @click="navigate('/')"
    >
      <span class="font-headline text-xl md:text-2xl font-bold tracking-widest text-[#d4af37]">{{ t('nav.brand') }}</span>
    </button>

    <!-- Navigation desktop (centrée) -->
    <div class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
      <button
        class="font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] transition-colors duration-200 hover:text-[#d4af37]"
        @click="navigate('/')"
      >
        {{ t('nav.games') }}
      </button>
      <button
        class="font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] transition-colors duration-200 hover:text-[#d4af37]"
        @click="navigate('/leaderboard')"
      >
        {{ t('nav.leaderboards') }}
      </button>
    </div>

    <div class="flex items-center gap-2 md:gap-3">
      <!-- Sélecteur de langue -->
      <button
        class="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:scale-110 active:scale-95"
        :aria-label="`Langue : ${LOCALES.find(l => l.code !== currentLocale)?.label}`"
        :title="`Switch to ${LOCALES.find(l => l.code !== currentLocale)?.label}`"
        @click="switchLocale"
      >
        {{ LOCALES.find(l => l.code === currentLocale)?.flag }}
      </button>

      <!-- Profil -->
      <button
        class="text-[#d4c59f] transition-all hover:text-[#d4af37] active:scale-95"
        :aria-label="t('nav.profile')"
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
        {{ t('nav.logout') }}
      </button>
      <button
        v-else
        class="hidden items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#d4af37] transition hover:bg-[#d4af37]/20 md:flex"
        @click="navigate('/login')"
      >
        {{ t('nav.login') }}
      </button>

      <!-- Hamburger mobile -->
      <button
        class="flex h-9 w-9 items-center justify-center rounded-md border border-[#4d4635] bg-black/20 text-[#d4c59f] transition hover:text-[#d4af37] md:hidden"
        :aria-expanded="mobileMenuOpen"
        :aria-label="t('nav.menu')"
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
          {{ t('nav.games') }}
        </button>
        <button
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-[#d4c59f] hover:bg-white/5 hover:text-[#d4af37] transition"
          role="menuitem"
          @click="navigate('/leaderboard')"
        >
          {{ t('nav.leaderboards') }}
        </button>
        <div class="mx-6 my-1 h-px bg-white/10"></div>
        <button
          v-if="auth.user"
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-red-400/70 hover:bg-white/5 hover:text-red-400 transition"
          role="menuitem"
          @click="auth.logout(); mobileMenuOpen = false"
        >
          {{ t('nav.logout_mobile') }}
        </button>
        <button
          v-else
          class="px-6 py-4 text-left font-headline text-sm font-medium uppercase tracking-widest text-[#d4af37] hover:bg-white/5 transition"
          role="menuitem"
          @click="navigate('/login')"
        >
          {{ t('nav.login') }}
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
