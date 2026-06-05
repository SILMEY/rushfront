<script setup lang="ts">
import { useAuthStore } from "../stores/authStore";
import { useI18n } from "vue-i18n";

const auth = useAuthStore();
const { t } = useI18n();
</script>

<template>
  <div class="relative mx-auto grid max-w-5xl gap-10 py-10 px-6">
    <section class="relative z-10 mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 p-10 backdrop-blur">
      <div class="text-center">
        <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-amber-300/80">{{ t('login.access_label') }}</div>
        <h1 class="mt-4 text-5xl font-headline font-extrabold uppercase tracking-[0.12em] text-amber-300">{{ t('login.title') }}</h1>
        <p class="mt-5 text-lg italic leading-relaxed text-slate-200/80">{{ t('login.subtitle') }}</p>
      </div>

      <div class="my-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        <button class="group flex flex-col items-center justify-center gap-3 py-4 transition-all duration-300 hover:scale-105 active:scale-95" :aria-label="t('login.google_label')" @click="auth.loginWithGoogle()">
          <div class="rf-shield relative flex h-20 w-16 items-center justify-center border-2 border-white/10 bg-white/5 transition-colors group-hover:border-amber-300/60 group-hover:bg-white/10" aria-hidden="true">
            <span class="material-symbols-outlined text-3xl text-amber-300" style="font-variation-settings: 'FILL' 1">castle</span>
          </div>
          <span class="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-200/80">{{ t('login.google_text') }}</span>
        </button>

        <button class="group flex flex-col items-center justify-center gap-3 py-4 transition-all duration-300 hover:scale-105 active:scale-95" :aria-label="t('login.discord_label')" @click="auth.loginWithDiscord()">
          <div class="rf-shield relative flex h-20 w-16 items-center justify-center border-2 border-white/10 bg-white/5 transition-colors group-hover:border-indigo-400/60 group-hover:bg-white/10">
            <svg class="h-8 w-8 fill-indigo-400" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          <span class="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-200/80">{{ t('login.discord_text') }}</span>
        </button>
      </div>

      <div class="mt-12 text-center">
        <div class="text-xs uppercase tracking-[0.25em] text-slate-200/60">{{ t('login.terms') }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rf-shield {
  clip-path: polygon(50% 0%, 88% 16%, 88% 60%, 50% 100%, 12% 60%, 12% 16%);
}
</style>
