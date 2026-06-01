<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();

const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);

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

  const soldiers =
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

  return { soldiers, wood, stone };
});
</script>

<template>
  <div
    v-if="me"
    class="wood-texture etched-line flex h-14 w-full items-center justify-center gap-10 border-b-2 border-outline-variant px-8 shadow-xl"
  >
    <div class="flex items-center gap-3 cursor-default">
      <span class="material-symbols-outlined text-[#ffd700]" style="font-variation-settings: 'FILL' 1">forest</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">BOIS: {{ me.resources.wood }} (+{{ production.wood }})</span>
    </div>

    <div class="flex items-center gap-3 cursor-default">
      <span class="material-symbols-outlined text-[#a0a0a0]" style="font-variation-settings: 'FILL' 1">foundation</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">PIERRE: {{ me.resources.stone }} (+{{ production.stone }})</span>
    </div>

    <div class="flex items-center gap-3 cursor-default">
      <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1">swords</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">MILITAIRES/T: +{{ production.soldiers }}</span>
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

