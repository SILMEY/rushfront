<script setup lang="ts">
import AppFooter from "../components/AppFooter.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-12">

    <div class="mb-10">
      <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-primary/70">{{ t('privacy.header_label') }}</div>
      <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-[0.12em] text-primary">{{ t('privacy.title') }}</h1>
      <p class="mt-3 text-sm text-secondary/50">{{ t('privacy.last_updated') }}</p>
    </div>

    <div class="space-y-8 rounded-2xl border border-outline-variant/30 bg-black/30 p-8 text-secondary/80 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">{{ t('privacy.section_data') }}</h2>
        <p class="leading-relaxed">{{ t('privacy.data_text') }}</p>
      </section>
      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">{{ t('privacy.section_usage') }}</h2>
        <p class="leading-relaxed">{{ t('privacy.usage_intro') }}</p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-secondary/70">
          <li>{{ t('privacy.usage_identify') }}</li>
          <li>{{ t('privacy.usage_display') }}</li>
          <li>{{ t('privacy.usage_prefs') }}</li>
          <li>{{ t('privacy.usage_leaderboard') }}</li>
        </ul>
      </section>
      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">{{ t('privacy.section_sharing') }}</h2>
        <p class="leading-relaxed">{{ t('privacy.sharing_text') }}</p>
      </section>
      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">{{ t('privacy.section_cookies') }}</h2>
        <p class="leading-relaxed">{{ t('privacy.cookies_text') }}</p>
      </section>
      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">{{ t('privacy.section_rights') }}</h2>
        <p class="leading-relaxed">{{ t('privacy.rights_text') }}</p>
      </section>

    </div>

  </div>
  <AppFooter />
</template>

<style scoped>
.text-primary   { color: #d4af37; }
.text-secondary { color: #d4c59f; }
.border-outline-variant\/30 { border-color: rgba(77,70,53,0.3); }
</style>
