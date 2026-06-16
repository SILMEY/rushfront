<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import { getSocket } from "../../composables/useSocket";
import { useI18n } from "vue-i18n";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
const game = useGameStore();
const { t } = useI18n();

async function surrender() {
  if (!props.state) return;
  if (!window.confirm("Se rendre ? Vous perdrez la partie.")) return;
  const socket = await getSocket();
  socket.emit("game:surrender", { gameId: props.state.gameId });
}

const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);

const nowMs = ref(Date.now());
let interval: number | null = null;
onMounted(() => { interval = window.setInterval(() => { nowMs.value = Date.now(); }, 250); });
onUnmounted(() => { if (interval !== null) window.clearInterval(interval); });

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function inBounds(pos: Vec2, w: number, h: number) { return pos.x >= 0 && pos.y >= 0 && pos.x < w && pos.y < h; }
function idxFn(pos: Vec2, w: number) { return pos.y * w + pos.x; }
function orthNeighbors(pos: Vec2): Vec2[] {
  return [{ x: pos.x+1, y: pos.y }, { x: pos.x-1, y: pos.y }, { x: pos.x, y: pos.y+1 }, { x: pos.x, y: pos.y-1 }];
}
function adjCount(state: GameStateSnapshot, pos: Vec2, type: TileType) {
  let n = 0;
  for (const nb of orthNeighbors(pos)) {
    if (!inBounds(nb, state.width, state.height)) continue;
    if ((state.tiles.types[idxFn(nb, state.width)] as TileType) === type) n++;
  }
  return n;
}

const PROD_SCALE = 0.01;

const ownedTiles = computed(() => {
  if (!props.state || !me.value) return 0;
  return props.state.tiles.owners.filter(o => o === me.value!.id).length;
});

const cityCount = computed(() => {
  if (!props.state || !me.value) return 0;
  let n = 0;
  for (let i = 0; i < props.state.tiles.buildings.length; i++)
    if (props.state.tiles.owners[i] === me.value.id && props.state.tiles.buildings[i] === BuildingType.City) n++;
  return n;
});

const maxHabitants = computed(() => ownedTiles.value * 5 + cityCount.value * 500);

const habitants = computed(() => {
  const p = me.value;
  return p ? p.resources.villagers + p.resources.soldiers : 0;
});

const detail = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return null;

  const techs = new Set(player.techs ?? []);
  const civ = (player as any).civilization as string | undefined;
  const pfb = (player as any).portFishingBoats as Record<string, number> | undefined;
  const fishingBoats = pfb ? Object.values(pfb).reduce((s, n) => s + n, 0) : 0;

  const passiveWood  = Math.floor(player.resources.villagers / 12);
  const passiveStone = Math.floor(player.resources.villagers / 24);

  type SawmillInfo = { forests: number; raw: number };
  type MineInfo    = { quarries: number; raw: number };
  const sawmills: SawmillInfo[] = [];
  const mines:    MineInfo[]    = [];

  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] !== player.id) continue;
    const b = state.tiles.buildings[i] as BuildingType | null;
    if (b === BuildingType.Sawmill) {
      const pos = { x: i % state.width, y: Math.floor(i / state.width) };
      const forests = adjCount(state, pos, TileType.Forest);
      sawmills.push({ forests, raw: Math.min(15, forests * 5) });
    }
    if (b === BuildingType.Mine) {
      const pos = { x: i % state.width, y: Math.floor(i / state.width) };
      const quarries = adjCount(state, pos, TileType.Quarry);
      mines.push({ quarries, raw: Math.min(15, quarries * 5) });
    }
  }

  const ecoToolsWood  = techs.has("eco_tools") ? sawmills.length * 5 : 0;
  const ecoToolsStone = techs.has("eco_tools") ? mines.length * 5 : 0;
  const sawmillRaw = sawmills.reduce((s, sm) => s + sm.raw, 0);
  const mineRaw    = mines.reduce((s, m) => s + m.raw, 0);

  const civMultWood  = civ === "sylvan_elves" ? 2 : 1;
  const civMultStone = civ === "iron_dwarves" ? 2 : 1;
  const aureliBonus  = civ === "aurelian_empire" ? Math.floor(ownedTiles.value / 10) : 0;

  const totalRawWood  = (passiveWood + sawmillRaw + ecoToolsWood) * civMultWood + aureliBonus;
  const totalRawStone = (passiveStone + mineRaw + ecoToolsStone) * civMultStone + aureliBonus;

  const naturalGrowth   = habitants.value < maxHabitants.value
    ? Math.sqrt(ownedTiles.value + cityCount.value * 50) * 0.10 : 0;
  const fishingGrowth   = fishingBoats * 0.1;
  const totalGrowth     = naturalGrowth + fishingGrowth;

  return {
    wood: {
      total: totalRawWood,
      perSec: totalRawWood * PROD_SCALE,
      passive: passiveWood,
      sawmills,
      ecoTools: ecoToolsWood,
      civMult: civMultWood,
      aureli: aureliBonus,
    },
    stone: {
      total: totalRawStone,
      perSec: totalRawStone * PROD_SCALE,
      passive: passiveStone,
      mines,
      ecoTools: ecoToolsStone,
      civMult: civMultStone,
      aureli: aureliBonus,
    },
    pop: {
      current: habitants.value,
      max: maxHabitants.value,
      natural: naturalGrowth,
      fishing: fishingGrowth,
      total: totalGrowth,
      fishingBoats,
      tiles: ownedTiles.value,
      cities: cityCount.value,
    }
  };
});

function fmtRate(v: number): string {
  if (v <= 0) return "";
  return v < 1 ? `+${v.toFixed(2)}/s` : `+${v.toFixed(1)}/s`;
}

const placingSecondsLeft = computed(() => {
  const s = props.state;
  if (!s || s.status !== "PLACING" || !s.placingEndsAt) return null;
  return Math.max(0, Math.ceil((s.placingEndsAt - nowMs.value) / 1000));
});

// Tooltip state
const hovered = ref<"wood" | "stone" | "pop" | null>(null);
const tooltipAnchor = ref<DOMRect | null>(null);

function onEnter(e: MouseEvent, key: "wood" | "stone" | "pop") {
  hovered.value = key;
  tooltipAnchor.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
}
function onLeave() { hovered.value = null; tooltipAnchor.value = null; }

const tooltipStyle = computed(() => {
  if (!tooltipAnchor.value) return {};
  return {
    left: `${tooltipAnchor.value.left}px`,
    top:  `${tooltipAnchor.value.bottom + 8}px`,
  };
});
</script>

<template>
  <div v-if="me" class="wood-texture etched-line w-full border-b-2 border-outline-variant shadow-xl overflow-x-auto">
  <div class="flex items-center gap-5 md:gap-10 px-4 md:px-8 py-2 min-w-max">

    <!-- Couleur -->
    <div class="flex items-center gap-2 md:gap-3 cursor-default" :title="t('resource_bar.color_tooltip')">
      <div class="h-4 w-4 rounded-full border border-black/40 shadow-[0_0_10px_rgba(242,202,80,0.15)]" :style="{ backgroundColor: me.color }"></div>
      <span class="font-label-sm italic font-bold text-primary-fixed">{{ t('resource_bar.color_label') }}</span>
    </div>

    <!-- Bois -->
    <div
      class="flex items-center gap-2 md:gap-3 cursor-help relative"
      @mouseenter="onEnter($event, 'wood')"
      @mouseleave="onLeave"
    >
      <span class="material-symbols-outlined text-[#ffd700]" style="font-variation-settings: 'FILL' 1">forest</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        <span class="hidden sm:inline">{{ t('resource_bar.wood_label') }}: </span>{{ me.resources.wood }}
        <span v-if="detail?.wood.perSec" class="opacity-60">({{ fmtRate(detail.wood.perSec) }})</span>
      </span>
    </div>

    <!-- Pierre -->
    <div
      class="flex items-center gap-2 md:gap-3 cursor-help"
      @mouseenter="onEnter($event, 'stone')"
      @mouseleave="onLeave"
    >
      <span class="material-symbols-outlined text-[#a0a0a0]" style="font-variation-settings: 'FILL' 1">foundation</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        <span class="hidden sm:inline">{{ t('resource_bar.stone_label') }}: </span>{{ me.resources.stone }}
        <span v-if="detail?.stone.perSec" class="opacity-60">({{ fmtRate(detail.stone.perSec) }})</span>
      </span>
    </div>

    <!-- Habitants -->
    <div
      class="flex items-center gap-2 md:gap-3 cursor-help"
      @mouseenter="onEnter($event, 'pop')"
      @mouseleave="onLeave"
    >
      <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1">groups</span>
      <span class="font-label-sm italic font-bold text-primary-fixed">
        <span class="hidden sm:inline">{{ t('resource_bar.habitants_label') }}: </span>{{ habitants }}/{{ maxHabitants }}
        <span v-if="detail?.pop.total && detail.pop.total > 0" class="opacity-60">({{ fmtRate(detail.pop.total) }})</span>
      </span>
    </div>

    <!-- Timer placing -->
    <div v-if="placingSecondsLeft !== null" class="flex items-center gap-2 cursor-default placing-timer" :class="{ urgent: placingSecondsLeft <= 3 }">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">timer</span>
      <span class="font-label-sm italic font-bold">
        <span class="hidden xs:inline">{{ t('resource_bar.placing_msg') }} — </span>{{ placingSecondsLeft }}s
      </span>
    </div>

    <!-- Surrender -->
    <button
      v-if="props.state?.status === 'ACTIVE' && !me.eliminated && !game.gameOver"
      class="ml-auto flex items-center gap-1 rounded border border-red-900/50 px-3 py-1 font-label-sm text-red-400/70 transition hover:border-red-500/60 hover:text-red-400"
      @click="surrender"
    >
      <span class="material-symbols-outlined text-[14px]">flag</span>
      <span class="hidden sm:inline">{{ t('resource_bar.surrender_btn') }}</span>
    </button>
  </div>
  </div>

  <!-- Tooltip -->
  <Teleport to="body">
    <div
      v-if="hovered && detail && tooltipAnchor"
      class="fixed z-[600] pointer-events-none"
      :style="tooltipStyle"
    >
      <div class="rounded border border-[#4d4635] bg-[#1a1508]/97 shadow-2xl px-4 py-3 min-w-[220px] text-[11px] space-y-2">

        <!-- BOIS -->
        <template v-if="hovered === 'wood' && detail.wood">
          <div class="font-bold text-[#ffd700] flex items-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[13px]">forest</span> Bois
          </div>
          <div class="space-y-1 text-white/60">
            <div class="flex justify-between">
              <span>⚒ Passif (hab ÷ 12)</span>
              <span class="text-[#a8c090]">{{ fmtRate(detail.wood.passive * 0.01) }}</span>
            </div>
            <div v-for="(sm, i) in detail.wood.sawmills" :key="i" class="flex justify-between pl-2">
              <span>🌲 Scierie {{ i+1 }} ({{ sm.forests }} forêt{{ sm.forests > 1 ? 's' : '' }})</span>
              <span class="text-[#a8c090]">{{ fmtRate(sm.raw * 0.01) }}</span>
            </div>
            <div v-if="detail.wood.ecoTools" class="flex justify-between pl-2">
              <span>🔧 Éco. outils (+5×{{ detail.wood.sawmills.length }})</span>
              <span class="text-[#a8c090]">{{ fmtRate(detail.wood.ecoTools * 0.01) }}</span>
            </div>
            <div v-if="detail.wood.civMult > 1" class="flex justify-between text-[#86efac]">
              <span>🌿 Bonus Elfes Sylvains</span><span>×2</span>
            </div>
            <div v-if="detail.wood.aureli" class="flex justify-between pl-2">
              <span>🏛 Aurélien ({{ detail.pop.tiles }} cases ÷ 10)</span>
              <span class="text-[#a8c090]">{{ fmtRate(detail.wood.aureli * 0.01) }}</span>
            </div>
          </div>
          <div class="border-t border-[#4d4635] pt-1.5 flex justify-between font-bold text-[#ffd700]">
            <span>Total</span><span>{{ fmtRate(detail.wood.perSec) }}</span>
          </div>
        </template>

        <!-- PIERRE -->
        <template v-if="hovered === 'stone' && detail.stone">
          <div class="font-bold text-[#a0a0a0] flex items-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[13px]">foundation</span> Pierre
          </div>
          <div class="space-y-1 text-white/60">
            <div class="flex justify-between">
              <span>⚒ Passif (hab ÷ 24)</span>
              <span class="text-[#c0c0c0]">{{ fmtRate(detail.stone.passive * 0.01) }}</span>
            </div>
            <div v-for="(m, i) in detail.stone.mines" :key="i" class="flex justify-between pl-2">
              <span>⛏ Mine {{ i+1 }} ({{ m.quarries }} carrière{{ m.quarries > 1 ? 's' : '' }})</span>
              <span class="text-[#c0c0c0]">{{ fmtRate(m.raw * 0.01) }}</span>
            </div>
            <div v-if="detail.stone.ecoTools" class="flex justify-between pl-2">
              <span>🔧 Éco. outils (+5×{{ detail.stone.mines.length }})</span>
              <span class="text-[#c0c0c0]">{{ fmtRate(detail.stone.ecoTools * 0.01) }}</span>
            </div>
            <div v-if="detail.stone.civMult > 1" class="flex justify-between text-[#a8c090]">
              <span>⚙ Bonus Nains de Fer</span><span>×2</span>
            </div>
            <div v-if="detail.stone.aureli" class="flex justify-between pl-2">
              <span>🏛 Aurélien ({{ detail.pop.tiles }} cases ÷ 10)</span>
              <span class="text-[#c0c0c0]">{{ fmtRate(detail.stone.aureli * 0.01) }}</span>
            </div>
          </div>
          <div class="border-t border-[#4d4635] pt-1.5 flex justify-between font-bold text-[#a0a0a0]">
            <span>Total</span><span>{{ fmtRate(detail.stone.perSec) }}</span>
          </div>
        </template>

        <!-- HABITANTS -->
        <template v-if="hovered === 'pop' && detail.pop">
          <div class="font-bold text-[#ffe088] flex items-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[13px]">groups</span> Population
          </div>
          <div class="space-y-1 text-white/60">
            <div class="flex justify-between">
              <span>Max</span>
              <span class="text-white/80">{{ detail.pop.tiles }}×5 + {{ detail.pop.cities }}×500 = <b class="text-[#ffe088]">{{ detail.pop.max }}</b></span>
            </div>
            <div class="flex justify-between">
              <span>🌱 Croissance naturelle</span>
              <span class="text-[#a8c090]">{{ fmtRate(detail.pop.natural) }}</span>
            </div>
            <div v-if="detail.pop.fishingBoats > 0" class="flex justify-between pl-2">
              <span>⛵ {{ detail.pop.fishingBoats }} bateau{{ detail.pop.fishingBoats > 1 ? 'x' : '' }} × 0.1</span>
              <span class="text-[#a8c090]">{{ fmtRate(detail.pop.fishing) }}</span>
            </div>
          </div>
          <div class="border-t border-[#4d4635] pt-1.5 flex justify-between font-bold text-[#ffe088]">
            <span>Total croissance</span><span>{{ detail.pop.total > 0 ? fmtRate(detail.pop.total) : 'max atteint' }}</span>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.etched-line { box-shadow: inset 1px 1px 1px rgba(0,0,0,0.4), 1px 1px 0px rgba(255,255,255,0.05); }
.wood-texture {
  background-color: #2b2319;
  background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 4px);
  box-shadow: inset 0 0 50px rgba(0,0,0,0.5);
}
.border-outline-variant { border-color: #4d4635; }
.text-primary-fixed { color: #ffe088; }
.font-label-sm {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  font-size: 12px; line-height: 16px; letter-spacing: 0.1em;
}
.placing-timer { color: #ffd700; }
.placing-timer.urgent { color: #ff4444; animation: pulse 0.5s ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
</style>
