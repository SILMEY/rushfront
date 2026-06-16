<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";

const props = defineProps<{
  state: GameStateSnapshot;
  tile: Vec2;
  clientX: number;
  clientY: number;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const auth = useAuthStore();
const game = useGameStore();
const me   = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);

const civ         = computed(() => me.value?.civilization ?? "");
const barracksKey = computed(() => `${props.tile.x}_${props.tile.y}`);
const myUnits     = computed(() => game.landUnits.filter(u => u.playerId === me.value?.id && u.barracksKey === barracksKey.value).length);
const maxUnits    = 2;
const unitsFull   = computed(() => myUnits.value >= maxUnits);
const canAfford   = computed(() => (me.value?.resources.wood ?? 0) >= 15 && (me.value?.resources.stone ?? 0) >= 10);
const canBuy      = computed(() => !unitsFull.value && canAfford.value);

const unitLabel  = computed(() => civ.value === "iron_dwarves" ? "Golem" : "Cavalier");
const unitIcon   = computed(() => civ.value === "iron_dwarves" ? "🗿" : "🏇");

function buy() {
  if (!canBuy.value) return;
  game.buyLandUnit(props.state.gameId, props.tile);
  emit("close");
}

const MARGIN = 80;
const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));
</script>

<template>
  <div class="fixed inset-0 z-[400]" @click="emit('close')" @contextmenu.prevent />

  <div class="fixed z-[401] -translate-x-1/2 -translate-y-1/2" :style="{ left: cx + 'px', top: cy + 'px' }">
    <div class="rounded-lg border border-[#8b7e66] bg-[#1c1812]/95 shadow-2xl p-4 min-w-[160px]">

      <!-- En-tête -->
      <div class="text-[9px] uppercase tracking-widest text-white/35 mb-3 text-center font-bold">
        Caserne · {{ myUnits }}/{{ maxUnits }}
      </div>

      <!-- Bouton d'achat -->
      <button
        class="w-full flex items-center gap-3 rounded border py-2.5 px-3 transition-all"
        :class="canBuy
          ? 'border-[#8b7e66] bg-[#1c1812]/60 hover:border-[#f2ca50] cursor-pointer'
          : 'border-[#8b7e66]/20 bg-[#1c1812]/40 opacity-40 cursor-not-allowed'"
        :disabled="!canBuy"
        @click.stop="buy"
      >
        <span class="text-2xl">{{ unitIcon }}</span>
        <div class="flex flex-col items-start">
          <span class="text-[12px] font-bold text-[#d4c59f]">{{ unitLabel }}</span>
          <span class="text-[10px] text-white/40">
            {{ unitsFull ? 'Maximum atteint' : '15🪵 10🪨' }}
          </span>
        </div>
      </button>

    </div>
  </div>
</template>
