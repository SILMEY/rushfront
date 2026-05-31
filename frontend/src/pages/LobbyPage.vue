<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";
import { useAuthStore } from "../stores/authStore";

const lobby = useLobbyStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const gameId = computed(() => String(route.params.id));
const current = computed(() => lobby.lobbies.find((l) => l.id === gameId.value) ?? null);
const me = computed(() => current.value?.players.find((p) => p.userId === auth.user?.id) ?? null);
const isHost = computed(() => current.value?.hostUserId === auth.user?.id);

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#a855f7",
  "#fde047",
  "#f97316",
  "#ffffff",
  "#22c55e",
  "#f472b6",
  "#06b6d4",
  "#e11d48"
];

onMounted(async () => {
  await lobby.ensureConnected();
  await lobby.joinLobby(gameId.value);
});

watch(
  () => lobby.lastStartedGameId,
  (id) => {
    if (id === gameId.value) router.push(`/game/${id}`);
  }
);
</script>

<template>
  <div class="grid gap-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">Lobby</h1>
        <div class="mt-1 text-xs text-slate-400">ID: {{ gameId }}</div>
      </div>
      <button class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10" @click="router.push('/')">
        Retour
      </button>
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Joueurs</h2>
        <div class="text-xs text-slate-400">Prêts requis: 2+</div>
      </div>
      <div class="mt-4 grid gap-2">
        <div
          v-for="p in current?.players ?? []"
          :key="p.id"
          class="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2"
        >
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded" :style="{ background: p.color }"></div>
            <div class="text-sm">{{ p.name }}</div>
          </div>
          <div class="text-xs" :class="p.isReady ? 'text-emerald-300' : 'text-slate-400'">
            {{ p.isReady ? 'Prêt' : 'Pas prêt' }}
          </div>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <div v-if="me" class="mr-auto flex flex-wrap items-center gap-2">
          <div class="text-xs text-slate-400">Couleur</div>
          <button
            v-for="c in COLORS"
            :key="c"
            class="h-7 w-7 rounded-md ring-1 ring-white/15 transition hover:scale-105"
            :style="{ background: c }"
            :title="c"
            :disabled="(current?.players ?? []).some((p) => p.color === c && p.userId !== auth.user?.id)"
            :class="[
              (current?.players ?? []).some((p) => p.color === c && p.userId !== auth.user?.id) ? 'opacity-25' : 'opacity-100',
              me.color === c ? 'ring-2 ring-emerald-300' : ''
            ]"
            @click="lobby.setColor(gameId, c)"
          />
        </div>
        <button
          v-if="me"
          class="rounded-lg bg-white/5 px-4 py-2 font-semibold ring-1 ring-white/10 hover:bg-white/10"
          @click="lobby.setReady(gameId, !me.isReady)"
        >
          {{ me.isReady ? 'Annuler prêt' : 'Prêt' }}
        </button>
        <button
          v-if="isHost"
          class="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white hover:bg-indigo-400"
          @click="lobby.startGame(gameId)"
        >
          Lancer la partie
        </button>
        <button class="ml-auto rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10" @click="lobby.leaveLobby(gameId)">
          Quitter
        </button>
      </div>

    </div>
  </div>
</template>
