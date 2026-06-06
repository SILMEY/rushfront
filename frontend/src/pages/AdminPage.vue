<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { apiFetch } from "../api/http";

interface TopPlayer { id: string; pseudo: string | null; name: string; avatarUrl: string | null; gamesPlayed: number }
interface TopWinner { id: string; pseudo: string | null; name: string; avatarUrl: string | null; quickGameWins: number }
interface DayStat   { date: string; count: number }
interface CivStat   { civilization: string; count: number }

interface AdminStats {
  totalUsers: number;
  totalHumanGames: number;
  gamesLast30Days: number;
  activeGamesNow: number;
  newUsersThisWeek: number;
  topPlayers: TopPlayer[];
  topWinners: TopWinner[];
  civPopularity: CivStat[];
  playersPerDay: DayStat[];
  gamesPerDay: DayStat[];
}

const stats = ref<AdminStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    stats.value = await apiFetch<AdminStats>("/admin/stats");
  } catch (e: any) {
    error.value = e.message ?? "Erreur inconnue";
  } finally {
    loading.value = false;
  }
});

const CIV_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  iron_dwarves:    { name: "Nains de Fer",      icon: "🏔️", color: "#94a3b8" },
  sylvan_elves:    { name: "Elfes Sylvains",     icon: "🌲", color: "#4ade80" },
  steppe_horde:    { name: "Horde des Steppes",  icon: "⚔️", color: "#f97316" },
  aurelian_empire: { name: "Empire d'Aurélien",  icon: "🏛️", color: "#d4af37" },
};

const civTotal = computed(() => stats.value?.civPopularity.reduce((s, c) => s + c.count, 0) ?? 1);

const playerChartMax = computed(() => Math.max(...(stats.value?.playersPerDay.map(d => d.count) ?? [1]), 1));
const gamesChartMax  = computed(() => Math.max(...(stats.value?.gamesPerDay.map(d => d.count) ?? [1]), 1));

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function playerName(p: { pseudo: string | null; name: string }) {
  return p.pseudo?.trim() || p.name;
}
function initials(p: { pseudo: string | null; name: string }) {
  return playerName(p).slice(0, 2).toUpperCase();
}
</script>

<template>
  <div class="min-h-screen bg-stone-950 pt-20 pb-16 px-4 md:px-8">
    <div class="mx-auto max-w-6xl">

      <!-- Header -->
      <div class="mb-8">
        <h1 class="font-headline text-3xl font-bold tracking-widest text-[#d4af37] uppercase">Panel Admin</h1>
        <p class="mt-1 text-sm text-[#d4c59f]/50">Statistiques globales — FrontRush</p>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-32">
        <span class="material-symbols-outlined animate-spin text-4xl text-[#d4af37]">progress_activity</span>
      </div>

      <div v-else-if="error" class="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-400">{{ error }}</div>

      <template v-else-if="stats">

        <!-- Ligne 1 : 5 cartes -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[#d4c59f]/40 mb-1">Joueurs inscrits</p>
            <p class="font-headline text-3xl font-bold text-[#d4af37]">{{ stats.totalUsers.toLocaleString("fr-FR") }}</p>
          </div>
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[#d4c59f]/40 mb-1">Parties (total)</p>
            <p class="font-headline text-3xl font-bold text-[#d4af37]">{{ stats.totalHumanGames.toLocaleString("fr-FR") }}</p>
          </div>
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[#d4c59f]/40 mb-1">Parties — 30j</p>
            <p class="font-headline text-3xl font-bold text-[#d4af37]">{{ stats.gamesLast30Days.toLocaleString("fr-FR") }}</p>
          </div>
          <div class="rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 mb-1">En jeu maintenant</p>
            <p class="font-headline text-3xl font-bold text-emerald-400">{{ stats.activeGamesNow }}</p>
          </div>
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[#d4c59f]/40 mb-1">Nouveaux — 7j</p>
            <p class="font-headline text-3xl font-bold text-[#d4af37]">{{ stats.newUsersThisWeek }}</p>
          </div>
        </div>

        <!-- Ligne 2 : Civilisations + Top vainqueurs -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">

          <!-- Popularité des civilisations -->
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-5">
            <h2 class="font-headline text-xs font-bold uppercase tracking-widest text-[#d4c59f]/60 mb-4">Civilisations jouées</h2>
            <div v-if="!stats.civPopularity.length" class="text-[#d4c59f]/30 text-sm">Aucune donnée</div>
            <div v-else class="space-y-3">
              <div v-for="civ in stats.civPopularity" :key="civ.civilization" class="flex items-center gap-3">
                <span class="w-5 text-center text-base leading-none">{{ CIV_LABELS[civ.civilization]?.icon ?? '?' }}</span>
                <span class="w-36 text-xs text-[#d4c59f]/80 truncate">{{ CIV_LABELS[civ.civilization]?.name ?? civ.civilization }}</span>
                <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{ width: (civ.count / civTotal * 100) + '%', background: CIV_LABELS[civ.civilization]?.color ?? '#d4af37' }"
                  />
                </div>
                <span class="text-xs font-bold text-[#d4c59f]/60 w-10 text-right">{{ civ.count }}</span>
                <span class="text-[10px] text-[#d4c59f]/30 w-8 text-right">{{ Math.round(civ.count / civTotal * 100) }}%</span>
              </div>
            </div>
          </div>

          <!-- Top 5 vainqueurs -->
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-5">
            <h2 class="font-headline text-xs font-bold uppercase tracking-widest text-[#d4c59f]/60 mb-4">Top 5 — Victoires rapides</h2>
            <div v-if="!stats.topWinners.length" class="text-[#d4c59f]/30 text-sm">Aucune victoire enregistrée</div>
            <ul v-else class="space-y-2">
              <li v-for="(w, i) in stats.topWinners" :key="w.id" class="flex items-center gap-3">
                <span class="w-5 text-center font-headline text-xs font-bold"
                  :class="i===0?'text-amber-400':i===1?'text-slate-300':i===2?'text-amber-700':'text-[#d4c59f]/30'">{{ i+1 }}</span>
                <img v-if="w.avatarUrl" :src="w.avatarUrl" class="h-7 w-7 rounded-full object-cover" />
                <span v-else class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-[#d4c59f]">{{ initials(w) }}</span>
                <span class="flex-1 truncate text-sm text-[#d4c59f]">{{ playerName(w) }}</span>
                <span class="font-headline text-sm font-bold text-amber-400">{{ w.quickGameWins }} <span class="text-[10px] text-[#d4c59f]/40 font-normal">victoire{{ w.quickGameWins > 1 ? 's' : '' }}</span></span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Ligne 3 : Top 10 parties jouées -->
        <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-5 mb-6">
          <h2 class="font-headline text-xs font-bold uppercase tracking-widest text-[#d4c59f]/60 mb-4">Top 10 — Parties jouées</h2>
          <div v-if="!stats.topPlayers.length" class="text-[#d4c59f]/30 text-sm">Aucune donnée</div>
          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div v-for="(p, i) in stats.topPlayers" :key="p.id" class="flex items-center gap-3">
              <span class="w-5 text-center font-headline text-xs font-bold"
                :class="i===0?'text-amber-400':i===1?'text-slate-300':i===2?'text-amber-700':'text-[#d4c59f]/30'">{{ i+1 }}</span>
              <img v-if="p.avatarUrl" :src="p.avatarUrl" class="h-7 w-7 rounded-full object-cover" />
              <span v-else class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-[#d4c59f]">{{ initials(p) }}</span>
              <span class="flex-1 truncate text-sm text-[#d4c59f]">{{ playerName(p) }}</span>
              <span class="font-headline text-sm font-bold text-[#d4af37]">{{ p.gamesPlayed }} <span class="text-[10px] text-[#d4c59f]/40 font-normal">partie{{ p.gamesPlayed > 1 ? 's' : '' }}</span></span>
            </div>
          </div>
        </div>

        <!-- Ligne 4 : 2 graphiques -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

          <!-- Nouveaux joueurs / jour -->
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-5">
            <h2 class="font-headline text-xs font-bold uppercase tracking-widest text-[#d4c59f]/60 mb-4">
              Nouveaux joueurs / jour <span class="text-[#d4c59f]/30 font-normal normal-case tracking-normal">(30 jours)</span>
            </h2>
            <div v-if="!stats.playersPerDay.length" class="text-[#d4c59f]/30 text-sm">Aucune inscription sur cette période</div>
            <template v-else>
              <div class="flex items-end gap-0.5 h-28">
                <div v-for="day in stats.playersPerDay" :key="day.date"
                  class="group relative flex flex-1 flex-col items-center justify-end" style="min-width:0">
                  <div class="w-full rounded-t bg-[#d4af37]/60 hover:bg-[#d4af37] transition-colors"
                    :style="{ height: Math.max(3, (day.count / playerChartMax) * 108) + 'px' }" />
                  <div class="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div class="rounded bg-stone-800 border border-[#4d4635] px-2 py-1 text-[10px] text-[#d4af37] whitespace-nowrap shadow-lg">
                      {{ formatDate(day.date) }} — {{ day.count }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-1.5 flex justify-between text-[9px] text-[#d4c59f]/25">
                <span>{{ formatDate(stats.playersPerDay[0].date) }}</span>
                <span>{{ formatDate(stats.playersPerDay[stats.playersPerDay.length - 1].date) }}</span>
              </div>
            </template>
          </div>

          <!-- Parties / jour -->
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-5">
            <h2 class="font-headline text-xs font-bold uppercase tracking-widest text-[#d4c59f]/60 mb-4">
              Parties terminées / jour <span class="text-[#d4c59f]/30 font-normal normal-case tracking-normal">(30 jours)</span>
            </h2>
            <div v-if="!stats.gamesPerDay.length" class="text-[#d4c59f]/30 text-sm">Aucune partie sur cette période</div>
            <template v-else>
              <div class="flex items-end gap-0.5 h-28">
                <div v-for="day in stats.gamesPerDay" :key="day.date"
                  class="group relative flex flex-1 flex-col items-center justify-end" style="min-width:0">
                  <div class="w-full rounded-t bg-emerald-500/50 hover:bg-emerald-400/80 transition-colors"
                    :style="{ height: Math.max(3, (day.count / gamesChartMax) * 108) + 'px' }" />
                  <div class="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div class="rounded bg-stone-800 border border-[#4d4635] px-2 py-1 text-[10px] text-emerald-400 whitespace-nowrap shadow-lg">
                      {{ formatDate(day.date) }} — {{ day.count }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-1.5 flex justify-between text-[9px] text-[#d4c59f]/25">
                <span>{{ formatDate(stats.gamesPerDay[0].date) }}</span>
                <span>{{ formatDate(stats.gamesPerDay[stats.gamesPerDay.length - 1].date) }}</span>
              </div>
            </template>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>
