<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
const game = useGameStore();
const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);

const now = ref(Date.now());
let timer: number | null = null;
onMounted(() => {
  timer = window.setInterval(() => (now.value = Date.now()), 250);
});
onBeforeUnmount(() => {
  if (timer != null) window.clearInterval(timer);
});

const secondsLeft = computed(() => {
  if (!props.state) return 0;
  return Math.ceil(Math.max(0, props.state.turnEndsAt - now.value) / 1000);
});

async function repartition() {
  if (!props.state || !me.value) return;
  const total = me.value.resources.villagers + me.value.resources.soldiers;
  const current = me.value.resources.soldiers;
  const raw = window.prompt(`Combien en militaires ? (0-${total})`, String(current));
  if (raw == null) return;
  const soldiers = Math.max(0, Math.min(total, Number.parseInt(raw, 10) || 0));
  await game.setComposition(props.state.gameId, soldiers);
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <div
      v-if="state"
      class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
      title="Fin de tour"
    >
      <span class="text-slate-300">⏱</span>
      <span class="font-mono">{{ secondsLeft }}s</span>
      <span class="text-slate-400">Tour {{ state.currentTurn }}</span>
    </div>

    <div
      v-if="me"
      class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
      title="Ta couleur"
    >
      <span class="inline-block h-3 w-3 rounded-sm ring-1 ring-white/20" :style="{ background: me.color }"></span>
      <span class="text-slate-200">Toi</span>
    </div>

    <div v-if="me" class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
      <span class="text-slate-300" title="Bois">🪵</span>
      <span class="font-mono">{{ me.resources.wood }}</span>
      <span class="text-slate-400">Bois</span>
    </div>

    <div v-if="me" class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
      <span class="text-slate-300" title="Pierre">🪨</span>
      <span class="font-mono">{{ me.resources.stone }}</span>
      <span class="text-slate-400">Pierre</span>
    </div>

    <div v-if="me" class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
      <span class="text-slate-300" title="Villageois (économie)">👨‍🌾</span>
      <span class="font-mono">{{ me.resources.villagers }}</span>
      <span class="text-slate-400">Villageois</span>
    </div>

    <div v-if="me" class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
      <span class="text-slate-300" title="Militaires">⚔️</span>
      <span class="font-mono">{{ me.resources.soldiers }}</span>
      <span class="text-slate-400">Militaires</span>
    </div>

    <button
      v-if="me && state"
      class="rounded-full bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10"
      @click="repartition()"
      title="Répartir villageois/militaires"
    >
      Répartir
    </button>
  </div>
</template>
