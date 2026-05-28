<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";

const lobby = useLobbyStore();
const router = useRouter();

onMounted(() => lobby.refresh());
</script>

<template>
  <div class="grid gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Accueil</h1>
      <button
        class="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white hover:bg-indigo-400"
        @click="lobby.createLobby()"
      >
        Créer une partie
      </button>
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Parties disponibles</h2>
        <button class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10" @click="lobby.refresh()">
          Rafraîchir
        </button>
      </div>

      <div class="mt-4 grid gap-3">
        <div v-if="lobby.lobbies.length === 0" class="text-sm text-slate-400">Aucune partie en lobby.</div>

        <div
          v-for="g in lobby.lobbies"
          :key="g.id"
          class="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3"
        >
          <div class="grid">
            <div class="text-sm font-semibold">Lobby {{ g.id.slice(0, 6) }}</div>
            <div class="text-xs text-slate-400">{{ g.playerCount }} / 10 joueurs</div>
          </div>
          <button
            class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10"
            @click="router.push(`/lobby/${g.id}`)"
          >
            Ouvrir
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

