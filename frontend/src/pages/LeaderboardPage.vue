<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiFetch } from "../api/http";

type LeaderboardEntry = {
  id: string;
  pseudo: string | null;
  name: string;
  avatarUrl: string | null;
  quickGameWins: number;
};

const players = ref<LeaderboardEntry[]>([]);
const loading = ref(true);

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
  <div class="mx-auto max-w-3xl px-6 py-12">

    <!-- En-tête -->
    <div class="mb-10 text-center">
      <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-primary/70">Gloire éternelle</div>
      <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-[0.12em] text-primary">
        Classement
      </h1>
      <p class="mt-3 text-sm italic text-secondary/60">Parties rapides remportées</p>
    </div>

    <!-- Tableau -->
    <div class="overflow-hidden rounded-2xl border border-outline-variant/30 bg-black/30 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

      <!-- Header -->
      <div class="flex items-center justify-between border-b border-outline-variant/30 bg-stone-900/60 px-6 py-3">
        <span class="text-[10px] font-headline font-bold uppercase tracking-[0.3em] text-secondary/50">Rang · Commandant</span>
        <span class="text-[10px] font-headline font-bold uppercase tracking-[0.3em] text-secondary/50">Victoires</span>
      </div>

      <!-- Chargement -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <span class="text-sm italic text-secondary/40">Chargement...</span>
      </div>

      <!-- Vide -->
      <div v-else-if="players.length === 0" class="flex flex-col items-center justify-center gap-4 py-20">
        <span class="material-symbols-outlined text-5xl text-primary/20" style="font-variation-settings:'FILL' 0">military_tech</span>
        <p class="text-sm italic text-secondary/40">Aucune victoire enregistrée pour l'instant.</p>
        <p class="text-xs uppercase tracking-widest text-secondary/30">Les parties rapides arrivent bientôt.</p>
      </div>

      <!-- Lignes -->
      <div v-else class="divide-y divide-outline-variant/20">
        <div
          v-for="(p, i) in players"
          :key="p.id"
          class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5"
          :class="i === 0 ? 'bg-primary/5' : ''"
        >
          <!-- Rang -->
          <div class="w-8 shrink-0 text-center">
            <span v-if="i === 0" class="material-symbols-outlined text-2xl text-yellow-400" style="font-variation-settings:'FILL' 1">military_tech</span>
            <span v-else-if="i === 1" class="material-symbols-outlined text-xl text-slate-300" style="font-variation-settings:'FILL' 1">military_tech</span>
            <span v-else-if="i === 2" class="material-symbols-outlined text-xl text-amber-700" style="font-variation-settings:'FILL' 1">military_tech</span>
            <span v-else class="font-headline text-sm font-bold text-secondary/40">{{ i + 1 }}</span>
          </div>

          <!-- Avatar + Nom -->
          <img
            v-if="p.avatarUrl"
            :src="p.avatarUrl"
            :alt="displayName(p)"
            class="h-10 w-10 rounded-full border border-outline-variant/40 object-cover"
          />
          <div v-else class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-outline-variant/40 bg-white/5 font-headline text-sm font-bold text-secondary/60">
            {{ displayName(p).slice(0, 2).toUpperCase() }}
          </div>

          <span class="flex-1 font-headline text-lg font-bold text-secondary" :class="i === 0 ? 'text-primary' : ''">
            {{ displayName(p) }}
          </span>

          <!-- Victoires -->
          <div class="flex items-center gap-2">
            <span class="font-headline text-2xl font-extrabold" :class="i === 0 ? 'text-primary' : 'text-secondary/80'">
              {{ p.quickGameWins }}
            </span>
            <span class="text-[10px] uppercase tracking-widest text-secondary/40">victoires</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-primary        { color: #d4af37; }
.text-secondary      { color: #d4c59f; }
.border-outline-variant\/30 { border-color: rgba(77,70,53,0.3); }
.border-outline-variant\/40 { border-color: rgba(77,70,53,0.4); }
.divide-outline-variant\/20 > * + * { border-color: rgba(77,70,53,0.2); }
</style>
