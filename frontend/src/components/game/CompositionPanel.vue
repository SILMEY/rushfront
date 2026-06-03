<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import SectionTitle from "./SectionTitle.vue";

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
  <section v-if="state && me" class="mb-5">
    <SectionTitle>Répartition</SectionTitle>

    <div v-if="!hasBarracks" class="text-[10px] italic text-white/25 text-center py-2">
      Construisez une caserne pour former des militaires.
    </div>

    <template v-else>
      <!-- Compteurs -->
      <div class="flex justify-between items-end mb-2.5">
        <div>
          <div class="text-[9px] uppercase tracking-widest text-[#a8c090]/60 mb-0.5">Villageois</div>
          <div class="text-[15px] font-bold text-[#a8c090] leading-none">{{ me.resources.villagers }}</div>
        </div>
        <div class="text-center">
          <div class="text-[9px] text-white/25 mb-0.5">total</div>
          <div class="text-[12px] font-bold text-white/40 leading-none">{{ me.resources.villagers + me.resources.soldiers }}</div>
        </div>
        <div class="text-right">
          <div class="text-[9px] uppercase tracking-widest text-[#ef4444]/60 mb-0.5">Militaires</div>
          <div class="text-[15px] font-bold text-[#ef4444]/80 leading-none">{{ me.resources.soldiers }}</div>
        </div>
      </div>

      <!-- Barre de répartition -->
      <div class="h-1.5 rounded-full overflow-hidden flex mb-2.5 bg-white/5">
        <div
          class="bg-[#4ade80]/50 transition-all duration-300"
          :style="{ width: (100 - compositionPct) + '%' }"
        ></div>
        <div class="bg-[#ef4444]/50 transition-all duration-300 flex-1"></div>
      </div>

      <!-- Slider -->
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
      <div class="flex justify-between text-[9px] text-white/20 mt-0.5">
        <span>100% civ.</span>
        <span class="text-white/30 font-bold">{{ 100 - compositionPct }}% / {{ compositionPct }}%</span>
        <span>100% mil.</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.section-title {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #d4af37;
  text-shadow: -1px -1px 1px rgba(0,0,0,.8), 1px 1px 1px rgba(255,255,255,.1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.diamond {
  display: inline-block;
  width: 7px;
  height: 7px;
  background-color: #d4af37;
  transform: rotate(45deg);
  flex-shrink: 0;
}
</style>
