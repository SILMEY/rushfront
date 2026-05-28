<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import GameCanvas from "../components/game/GameCanvas.vue";
import BuildPanel from "../components/game/BuildPanel.vue";
import ResourceBar from "../components/game/ResourceBar.vue";
import { useGameStore } from "../stores/gameStore";

const route = useRoute();
const router = useRouter();
const game = useGameStore();
const gameId = computed(() => String(route.params.id));

onMounted(async () => {
  await game.connect(gameId.value);
  await game.getState(gameId.value);
});
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Partie</h1>
        <div class="mt-1 text-xs text-slate-400">ID: {{ gameId }}</div>
      </div>
      <ResourceBar :state="game.state" />
      <button class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10" @click="router.push('/')">
        Accueil
      </button>
    </div>

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-10 rounded-xl border border-white/10 bg-slate-950/40">
        <GameCanvas class="h-[calc(100vh-180px)] min-h-[720px] w-full" :state="game.state" @tile-click="game.onTileClick" />
      </div>
      <div class="col-span-2 grid gap-4">
        <BuildPanel :state="game.state" :selected="game.selectedBuilding" @select="game.selectedBuilding = $event" />
      </div>
    </div>
  </div>
</template>
