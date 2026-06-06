<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiFetch } from "../api/http";
import AppFooter from "../components/AppFooter.vue";
import { useI18n } from "vue-i18n";
import { getGrade } from "../utils/grade";

type LeaderboardEntry = {
  id: string;
  pseudo: string | null;
  name: string;
  avatarUrl: string | null;
  quickGameWins: number;
  quickGamesPlayed: number;
  elo: number;
};

const players = ref<LeaderboardEntry[]>([]);
const loading = ref(true);
const { t } = useI18n();

onMounted(async () => {
  try {
    const res = await apiFetch<{ players: LeaderboardEntry[] }>("/leaderboard");
    players.value = res.players;
  } finally {
    loading.value = false;
  }
});

function displayName(p: LeaderboardEntry) {
  return p.pseudo?.trim() || p.name;
}
</script>

<template>
  <div class="flex flex-col" style="min-height: calc(100vh - 4rem)">
  <div class="mx-auto w-full max-w-3xl flex-1 px-4 py-12">

    <!-- En-tête -->
    <div class="mb-10 text-center">
      <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-primary/70">{{ t('leaderboard.glory_label') }}</div>
      <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-[0.12em] text-primary">{{ t('leaderboard.title') }}</h1>
      <p class="mt-3 text-sm italic text-secondary/60">{{ t('leaderboard.subtitle') }}</p>
    </div>

    <!-- Header colonnes -->
    <div class="mb-2 grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-4 text-[10px] font-headline font-bold uppercase tracking-[0.3em] text-secondary/40">
      <span>#</span>
      <span>{{ t('leaderboard.col_rank') }}</span>
      <span class="text-right w-20">{{ t('leaderboard.col_elo') }}</span>
      <span class="text-right w-14">{{ t('leaderboard.col_wins') }}</span>
    </div>

    <div class="overflow-hidden rounded-2xl border border-outline-variant/30 bg-black/30 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

      <!-- Chargement -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <span class="text-sm italic text-secondary/40">{{ t('leaderboard.loading') }}</span>
      </div>

      <!-- Vide -->
      <div v-else-if="players.length === 0" class="flex flex-col items-center justify-center gap-4 py-20">
        <span class="material-symbols-outlined text-5xl text-primary/20" style="font-variation-settings:'FILL' 0">military_tech</span>
        <p class="text-sm italic text-secondary/40">{{ t('leaderboard.no_victories') }}</p>
      </div>

      <!-- Lignes -->
      <div v-else class="divide-y divide-outline-variant/20">
        <div
          v-for="(p, i) in players"
          :key="p.id"
          class="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
          :class="i === 0 ? 'bg-primary/5' : ''"
        >
          <!-- Position -->
          <div class="text-center shrink-0">
            <span v-if="i === 0" class="material-symbols-outlined text-xl text-yellow-400" style="font-variation-settings:'FILL' 1">military_tech</span>
            <span v-else-if="i === 1" class="material-symbols-outlined text-lg text-slate-300" style="font-variation-settings:'FILL' 1">military_tech</span>
            <span v-else-if="i === 2" class="material-symbols-outlined text-lg text-amber-700" style="font-variation-settings:'FILL' 1">military_tech</span>
            <span v-else class="font-headline text-xs font-bold text-secondary/30">{{ i + 1 }}</span>
          </div>

          <!-- Avatar + Nom + Grade -->
          <div class="flex items-center gap-3 min-w-0">
            <img v-if="p.avatarUrl" :src="p.avatarUrl" :alt="displayName(p)"
              class="h-9 w-9 shrink-0 rounded-full border border-outline-variant/40 object-cover" />
            <div v-else class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-outline-variant/40 bg-white/5 font-headline text-xs font-bold text-secondary/60">
              {{ displayName(p).slice(0, 2).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <div class="font-headline text-base font-bold truncate" :class="i === 0 ? 'text-primary' : 'text-secondary'">
                {{ displayName(p) }}
              </div>
              <!-- Grade badge -->
              <div class="flex items-center gap-1 mt-0.5">
                <span class="text-sm leading-none">{{ getGrade(p.quickGamesPlayed).icon }}</span>
                <span
                  class="text-[10px] font-bold uppercase tracking-widest"
                  :style="{ color: getGrade(p.quickGamesPlayed).color }"
                >
                  {{ t('grade.' + getGrade(p.quickGamesPlayed).key) }}
                </span>
                <span class="text-[10px] text-secondary/30">· {{ p.quickGamesPlayed }} {{ t('leaderboard.games') }}</span>
              </div>
            </div>
          </div>

          <!-- ELO -->
          <div class="flex flex-col items-end w-20 shrink-0">
            <span class="font-headline text-xl font-extrabold" :class="i === 0 ? 'text-primary' : 'text-secondary/80'">
              {{ p.elo }}
            </span>
            <span class="text-[9px] uppercase tracking-widest text-secondary/30">ELO</span>
          </div>

          <!-- Victoires -->
          <div class="flex flex-col items-end w-14 shrink-0">
            <span class="font-headline text-lg font-bold text-secondary/60">{{ p.quickGameWins }}</span>
            <span class="text-[9px] uppercase tracking-widest text-secondary/30">{{ t('leaderboard.wins') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
  <AppFooter />
</template>

<style scoped>
.text-primary        { color: #d4af37; }
.text-secondary      { color: #d4c59f; }
.border-outline-variant\/30 { border-color: rgba(77,70,53,0.3); }
.border-outline-variant\/40 { border-color: rgba(77,70,53,0.4); }
.divide-outline-variant\/20 > * + * { border-color: rgba(77,70,53,0.2); }
</style>
