<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
const game = useGameStore();
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

const compositionPct = ref(0);
watch(
  () => me.value?.resources.soldiers,
  (v) => {
    const player = me.value;
    if (!player || typeof v !== "number") return;
    const total = player.resources.villagers + player.resources.soldiers;
    if (total <= 0) compositionPct.value = 0;
    else compositionPct.value = Math.round((player.resources.soldiers / total) * 100);
  },
  { immediate: true }
);

let compositionTimer: number | null = null;
function commitComposition() {
  if (!props.state || !me.value) return;
  const total = me.value.resources.villagers + me.value.resources.soldiers;
  const soldiers = Math.max(0, Math.min(total, Math.round((compositionPct.value / 100) * total)));
  void game.setComposition(props.state.gameId, soldiers);
}
function scheduleCommit() {
  if (compositionTimer != null) window.clearTimeout(compositionTimer);
  compositionTimer = window.setTimeout(() => {
    compositionTimer = null;
    commitComposition();
  }, 120);
}
</script>

<template>
  <div class="grid gap-2">
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
    </div>

    <div v-if="me && state" class="flex flex-wrap items-center gap-3 text-xs text-slate-300">
      <div class="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <div class="flex items-center justify-between gap-4">
          <div class="text-slate-400">Répartition</div>
          <div class="font-mono">
            {{ 100 - compositionPct }}% villageois • {{ compositionPct }}% militaires
          </div>
        </div>
        <div class="mt-1 text-[11px] text-slate-400">
          {{ me.resources.villagers }} villageois • {{ me.resources.soldiers }} militaires (total {{ me.resources.villagers + me.resources.soldiers }})
        </div>
        <input
          v-model.number="compositionPct"
          class="mt-2 w-full accent-indigo-400"
          type="range"
          :min="0"
          :max="100"
          :step="1"
          @input="scheduleCommit()"
          @change="commitComposition()"
        />
      </div>

      <div class="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <div class="text-slate-400">Production / tour</div>
        <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono">
          <div>⚔️ +{{ production.soldiers }}</div>
          <div>🪵 +{{ production.wood }}</div>
          <div>🪨 +{{ production.stone }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
