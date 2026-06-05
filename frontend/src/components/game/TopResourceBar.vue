<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import { getSocket } from "../../composables/useSocket";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
const game = useGameStore();

async function surrender() {
  if (!props.state) return;
  if (!window.confirm("Se rendre ? Vous perdrez la partie.")) return;
  const socket = await getSocket();
  socket.emit("game:surrender", { gameId: props.state.gameId });
}

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


const cityCount = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return 0;
  let n = 0;
  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] === player.id && state.tiles.buildings[i] === BuildingType.City) n++;
  }
  return n;
});

// Doit correspondre exactement à turnResolver.ts
const maxHabitants = computed(() => ownedTiles.value * 5 + cityCount.value * 500);

const habitantGrowthRate = computed(() => {
  if (!me.value) return 0;
  if (habitants.value >= maxHabitants.value) return 0;
  // Backend : Math.sqrt(ownedTiles + cityCount * 50) * 0.10 par seconde
  return Math.sqrt(ownedTiles.value + cityCount.value * 50) * 0.10;
});

const production = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return { wood: 0, stone: 0 };

  const techs = new Set(player.techs ?? []);
  const civ = (player as any).civilization as string | undefined;
  const fishingBoats: number = (player as any).fishingBoats ?? 0;

  // Passif villageois (identique backend)
  let wood  = Math.floor(player.resources.villagers / 12);
  let stone = Math.floor(player.resources.villagers / 24);

  let sawmillCount = 0;
  let mineCount = 0;

  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] !== player.id) continue;
    const b = state.tiles.buildings[i] as BuildingType | null;
    if (b === BuildingType.Sawmill) {
      sawmillCount++;
      const pos = { x: i % state.width, y: Math.floor(i / state.width) };
      // Backend : Math.min(15, adjacentForests * 5)
      wood += Math.min(15, adjacentCountOfType(state, pos, TileType.Forest) * 5);
    }
    if (b === BuildingType.Mine) {
      mineCount++;
      const pos = { x: i % state.width, y: Math.floor(i / state.width) };
      stone += Math.min(15, adjacentCountOfType(state, pos, TileType.Quarry) * 5);
    }
  }

  // Bonus eco_tools (backend : +sawmills*5 / +mines*5)
  if (techs.has("eco_tools")) { wood += sawmillCount * 5; stone += mineCount * 5; }

  // Bonus civilisations
  if (civ === "sylvan_elves") wood *= 2;
  if (civ === "iron_dwarves") stone *= 2;

  // Bonus empire d'Aurélien
  if (civ === "aurelian_empire") {
    const bonus = Math.floor(ownedTiles.value / 10);
    wood  += bonus;
    stone += bonus;
  }

  // Bateaux de pêche
  wood += fishingBoats * 3;

  return { wood, stone };
});


const habitants = computed(() => {
  const player = me.value;
  if (!player) return 0;
  return player.resources.villagers + player.resources.soldiers;
});


const placingSecondsLeft = computed(() => {
  const s = props.state;
  if (!s || s.status !== "PLACING" || !s.placingEndsAt) return null;
  return Math.max(0, Math.ceil((s.placingEndsAt - nowMs.value) / 1000));
});

// PROD_SCALE = 0.01 — gain moyen par seconde = raw * 0.01
const PROD_SCALE = 0.01;
function rate(raw: number): string {
  const v = raw * PROD_SCALE;
  if (v <= 0) return "";
  // Affiche 2 décimales sous 1/s, 1 décimale au-dessus
  if (v < 1) return `(+${v.toFixed(2)}/s)`;
  return `(+${v.toFixed(1)}/s)`;
}
function rateHab(v: number): string {
  if (v <= 0) return "";
  if (v < 1) return `(+${v.toFixed(2)}/s)`;
  return `(+${v.toFixed(1)}/s)`;
}
</script>

<template>
  <div v-if="me" class="wood-texture etched-line w-full border-b-2 border-outline-variant shadow-xl overflow-x-auto">
  <div class="flex items-center gap-5 md:gap-10 px-4 md:px-8 py-2 min-w-max">
    <div class="flex items-center gap-2 md:gap-3 cursor-default" title="Couleur de votre empire">
      <div class="h-4 w-4 rounded-full border border-black/40 shadow-[0_0_10px_rgba(242,202,80,0.15)]" :style="{ backgroundColor: me.color }"></div>
      <span class="font-label-sm italic font-bold text-primary-fixed">COULEUR</span>
    </div>

    <div class="flex items-center gap-2 md:gap-3 cursor-default" title="Bois">
      <span class="material-symbols-outlined text-[#ffd700]" style="font-variation-settings: 'FILL' 1" aria-hidden="true">forest</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        <span class="hidden sm:inline">BOIS: </span>{{ me.resources.wood }}
        <span v-if="production.wood" class="opacity-60">{{ rate(production.wood) }}</span>
      </span>
    </div>

    <div class="flex items-center gap-2 md:gap-3 cursor-default" title="Pierre">
      <span class="material-symbols-outlined text-[#a0a0a0]" style="font-variation-settings: 'FILL' 1" aria-hidden="true">foundation</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        <span class="hidden sm:inline">PIERRE: </span>{{ me.resources.stone }}
        <span v-if="production.stone" class="opacity-60">{{ rate(production.stone) }}</span>
      </span>
    </div>

    <div class="flex items-center gap-2 md:gap-3 cursor-default" title="Habitants">
      <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1" aria-hidden="true">groups</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        <span class="hidden sm:inline">HAB: </span>{{ habitants }}/{{ maxHabitants }}
        <span v-if="habitantGrowthRate > 0" class="opacity-60">{{ rateHab(habitantGrowthRate) }}</span>
      </span>
    </div>

    <div v-if="placingSecondsLeft !== null" class="flex items-center gap-2 cursor-default placing-timer" :class="{ urgent: placingSecondsLeft <= 3 }">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1" aria-hidden="true">timer</span>
      <span class="font-label-sm italic font-bold">
        <span class="hidden xs:inline">POSEZ VOTRE BASE — </span>{{ placingSecondsLeft }}s
      </span>
    </div>

    <button
      v-if="props.state?.status === 'ACTIVE' && !me.eliminated && !game.gameOver"
      class="ml-auto flex items-center gap-1 rounded border border-red-900/50 px-3 py-1 font-label-sm text-red-400/70 transition hover:border-red-500/60 hover:text-red-400"
      aria-label="Se rendre — quitter la partie"
      @click="surrender"
    >
      <span class="material-symbols-outlined text-[14px]" aria-hidden="true">flag</span>
      <span class="hidden sm:inline">SE RENDRE</span>
    </button>
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
.placing-timer {
  color: #ffd700;
}
.placing-timer.urgent {
  color: #ff4444;
  animation: pulse 0.5s ease-in-out infinite alternate;
}
@keyframes pulse {
  from { opacity: 1; }
  to { opacity: 0.5; }
}
</style>
