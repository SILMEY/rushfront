<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { apiFetch } from "../api/http";

interface TopPlayer {
  id: string;
  pseudo: string | null;
  name: string;
  avatarUrl: string | null;
  gamesPlayed: number;
}

interface DayStat {
  date: string;
  count: number;
}

interface AdminStats {
  totalUsers: number;
  totalHumanGames: number;
  topPlayers: TopPlayer[];
  playersPerDay: DayStat[];
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

const chartMax = computed(() => {
  if (!stats.value?.playersPerDay.length) return 1;
  return Math.max(...stats.value.playersPerDay.map(d => d.count), 1);
});

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function playerName(p: TopPlayer) {
  return p.pseudo?.trim() || p.name;
}

function initials(p: TopPlayer) {
  return playerName(p).slice(0, 2).toUpperCase();
}
</script>

<template>
  <div class="min-h-screen bg-stone-950 pt-20 pb-12 px-4 md:px-8">
    <div class="mx-auto max-w-5xl">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="font-headline text-3xl font-bold tracking-widest text-[#d4af37] uppercase">
          Panel Admin
        </h1>
        <p class="mt-1 text-sm text-[#d4c59f]/60">Statistiques globales du jeu</p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-24">
        <span class="material-symbols-outlined animate-spin text-4xl text-[#d4af37]">progress_activity</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-400">
        {{ error }}
      </div>

      <template v-else-if="stats">
        <!-- Stat cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-8">
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-6">
            <p class="text-xs font-bold uppercase tracking-widest text-[#d4c59f]/50 mb-2">Joueurs inscrits</p>
            <p class="font-headline text-5xl font-bold text-[#d4af37]">{{ stats.totalUsers.toLocaleString("fr-FR") }}</p>
          </div>
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-6">
            <p class="text-xs font-bold uppercase tracking-widest text-[#d4c59f]/50 mb-2">Parties jouées</p>
            <p class="font-headline text-5xl font-bold text-[#d4af37]">{{ stats.totalHumanGames.toLocaleString("fr-FR") }}</p>
          </div>
        </div>

        <!-- Top 10 players + chart side by side -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Top 10 -->
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-6">
            <h2 class="font-headline text-sm font-bold uppercase tracking-widest text-[#d4c59f]/70 mb-4">
              Top 10 — Parties jouées
            </h2>
            <div v-if="!stats.topPlayers.length" class="text-[#d4c59f]/40 text-sm">Aucune donnée</div>
            <ul v-else class="space-y-2">
              <li
                v-for="(player, index) in stats.topPlayers"
                :key="player.id"
                class="flex items-center gap-3"
              >
                <!-- Rank -->
                <span
                  class="w-6 text-center font-headline text-xs font-bold"
                  :class="index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-700' : 'text-[#d4c59f]/30'"
                >
                  {{ index + 1 }}
                </span>
                <!-- Avatar -->
                <img
                  v-if="player.avatarUrl"
                  :src="player.avatarUrl"
                  class="h-8 w-8 rounded-full object-cover"
                  :alt="playerName(player)"
                />
                <span
                  v-else
                  class="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#d4c59f]"
                >
                  {{ initials(player) }}
                </span>
                <!-- Name -->
                <span class="flex-1 truncate text-sm text-[#d4c59f]">{{ playerName(player) }}</span>
                <!-- Count -->
                <span class="font-headline text-sm font-bold text-[#d4af37]">
                  {{ player.gamesPlayed }} partie{{ player.gamesPlayed > 1 ? 's' : '' }}
                </span>
              </li>
            </ul>
          </div>

          <!-- Players per day chart -->
          <div class="rounded-xl border border-[#4d4635] bg-stone-900/60 p-6">
            <h2 class="font-headline text-sm font-bold uppercase tracking-widest text-[#d4c59f]/70 mb-4">
              Nouveaux joueurs — 30 derniers jours
            </h2>
            <div v-if="!stats.playersPerDay.length" class="text-[#d4c59f]/40 text-sm">Aucune inscription sur cette période</div>
            <div v-else class="flex items-end gap-1 h-40">
              <div
                v-for="day in stats.playersPerDay"
                :key="day.date"
                class="group relative flex flex-1 flex-col items-center justify-end"
                style="min-width: 0"
              >
                <div
                  class="w-full rounded-t bg-[#d4af37]/70 hover:bg-[#d4af37] transition-colors"
                  :style="{ height: Math.max(4, (day.count / chartMax) * 140) + 'px' }"
                />
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div class="rounded bg-stone-800 border border-[#4d4635] px-2 py-1 text-xs text-[#d4af37] whitespace-nowrap shadow-lg">
                    {{ formatDate(day.date) }} — {{ day.count }}
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-2 flex justify-between text-[10px] text-[#d4c59f]/30">
              <span>{{ stats.playersPerDay.length ? formatDate(stats.playersPerDay[0].date) : '' }}</span>
              <span>{{ stats.playersPerDay.length ? formatDate(stats.playersPerDay[stats.playersPerDay.length - 1].date) : '' }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
