<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
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
      <span class="text-slate-300" title="Armée (points d'expansion)">⚔️</span>
      <span class="font-mono">{{ me.resources.expansion }}</span>
      <span class="text-slate-400">Armée</span>
    </div>
  </div>
</template>
