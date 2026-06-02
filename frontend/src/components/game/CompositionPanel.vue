<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
const game = useGameStore();

const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);

const hasBarracks = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return false;
  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] === player.id && state.tiles.buildings[i] === BuildingType.Barracks) return true;
  }
  return false;
});

const compositionPct = ref(50);
watch(
  () => me.value?.desiredSoldierPct,
  (v) => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      compositionPct.value = 50;
      return;
    }
    compositionPct.value = Math.max(0, Math.min(100, Math.round(v)));
  },
  { immediate: true }
);

let timer: number | null = null;
function commit() {
  if (!props.state) return;
  void game.setComposition(props.state.gameId, compositionPct.value);
}
function scheduleCommit() {
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    commit();
  }, 120);
}
</script>

<template>
  <section v-if="state && me" class="mt-6">
    <h3 class="font-label-sm text-primary mb-4 flex items-center gap-2 carved-text">
      <span class="w-2 h-2 bg-primary rotate-45"></span> RÉPARTITION
    </h3>
    <div class="bg-black/30 p-4 border-l-4 border-outline shadow-inner">
      <div v-if="!hasBarracks" class="text-[10px] italic text-on-surface/40 text-center py-1">
        Construisez une caserne pour former des militaires
      </div>
      <template v-else>
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-bold text-on-surface uppercase tracking-tight">Villageois / Militaires</span>
          <span class="text-[10px] text-on-surface/50 italic">{{ 100 - compositionPct }}% / {{ compositionPct }}%</span>
        </div>
        <input
          v-model.number="compositionPct"
          type="range"
          min="0"
          max="100"
          step="1"
          class="w-full accent-[#f2ca50]"
          @input="scheduleCommit()"
          @change="commit()"
        />
        <div class="mt-2 text-[10px] uppercase tracking-[0.2em] text-on-surface/50">
          Total: {{ me.resources.villagers + me.resources.soldiers }}
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.font-label-sm {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}
.carved-text {
  text-shadow: -1px -1px 1px rgba(0, 0, 0, 0.8), 1px 1px 1px rgba(255, 255, 255, 0.1);
}
.text-primary {
  color: #d4af37;
}
.bg-primary {
  background-color: #d4af37;
}
.border-outline {
  border-color: #99907c;
}
.text-on-surface {
  color: #e5e2e0;
}
</style>
