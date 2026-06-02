<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();

const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);

const nowMs = ref(Date.now());
let interval: number | null = null;
onMounted(() => {
  interval = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 250);
});
onUnmounted(() => {
  if (interval !== null) window.clearInterval(interval);
});

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function inBounds(pos: Vec2, width: number, height: number) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < width && pos.y < height;
}
function idx(pos: Vec2, width: number) {
  return pos.y * width + pos.x;
}
function orthogonalNeighbors(pos: Vec2): Vec2[] {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 }
  ];
}
function adjacentCountOfType(state: GameStateSnapshot, pos: Vec2, type: TileType) {
  let count = 0;
  for (const n of orthogonalNeighbors(pos)) {
    if (!inBounds(n, state.width, state.height)) continue;
    if ((state.tiles.types[idx(n, state.width)] as TileType) === type) count++;
  }
  return count;
}

const ownedTiles = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return 0;
  let count = 0;
  for (const o of state.tiles.owners) if (o === player.id) count++;
  return count;
});

const fishingHuts = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return 0;
  let count = 0;
  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] !== player.id) continue;
    if (state.tiles.buildings[i] === BuildingType.FishingHut) count++;
  }
  return count;
});

const production = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return { soldiers: 0, wood: 0, stone: 0 };

  const recruits =
    Math.floor(player.resources.villagers / 10) + (1 + Math.floor(ownedTiles.value / 12) + Math.floor(fishingHuts.value / 2));
  let wood = Math.floor(player.resources.villagers / 12);
  let stone = Math.floor(player.resources.villagers / 24);

  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] !== player.id) continue;
    const b = state.tiles.buildings[i] as BuildingType | null;
    if (b !== BuildingType.Sawmill && b !== BuildingType.Mine) continue;
    const pos = { x: i % state.width, y: Math.floor(i / state.width) };
    if (b === BuildingType.Sawmill) wood += Math.min(3, adjacentCountOfType(state, pos, TileType.Forest));
    if (b === BuildingType.Mine) stone += Math.min(3, adjacentCountOfType(state, pos, TileType.Quarry));
  }

  return { recruits, wood, stone };
});


const habitants = computed(() => {
  const player = me.value;
  if (!player) return 0;
  return player.resources.villagers + player.resources.soldiers;
});

// PROD_SCALE = 0.01 (100ms turns, 1 tick/s) — expected gain per second
const PROD_SCALE = 0.01;
function rate(raw: number): string {
  const v = raw * PROD_SCALE;
  if (v <= 0) return "";
  if (v < 0.1) return `(+${v.toFixed(2)}/s)`;
  return `(+${v.toFixed(1)}/s)`;
}
</script>

<template>
  <div
    v-if="me"
    class="wood-texture etched-line flex w-full items-center justify-center gap-10 border-b-2 border-outline-variant px-8 py-2 shadow-xl"
  >
    <div class="flex items-center gap-3 cursor-default">
      <div class="h-4 w-4 rounded-full border border-black/40 shadow-[0_0_10px_rgba(242,202,80,0.15)]" :style="{ backgroundColor: me.color }"></div>
      <span class="font-label-sm italic font-bold text-primary-fixed">COULEUR</span>
    </div>

    <div class="flex items-center gap-3 cursor-default">
      <span class="material-symbols-outlined text-[#ffd700]" style="font-variation-settings: 'FILL' 1">forest</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        BOIS: {{ me.resources.wood }}
        <span v-if="production.wood" class="opacity-60">{{ rate(production.wood) }}</span>
      </span>
    </div>

    <div class="flex items-center gap-3 cursor-default">
      <span class="material-symbols-outlined text-[#a0a0a0]" style="font-variation-settings: 'FILL' 1">foundation</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        PIERRE: {{ me.resources.stone }}
        <span v-if="production.stone" class="opacity-60">{{ rate(production.stone) }}</span>
      </span>
    </div>

    <div class="flex items-center gap-3 cursor-default">
      <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1">groups</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        HABITANTS: {{ habitants }}
        <span v-if="production.recruits" class="opacity-60">{{ rate(production.recruits) }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.etched-line {
  box-shadow: inset 1px 1px 1px rgba(0, 0, 0, 0.4), 1px 1px 0px rgba(255, 255, 255, 0.05);
}
.wood-texture {
  background-color: #2b2319;
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.02) 0px, rgba(255, 255, 255, 0.02) 2px, transparent 2px, transparent 4px);
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.5);
}
.border-outline-variant {
  border-color: #4d4635;
}
.text-primary-fixed {
  color: #ffe088;
}
.font-label-sm {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.1em;
}
</style>
