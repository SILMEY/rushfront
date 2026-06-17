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
const isHorde     = computed(() => civ.value === "steppe_horde");

// Pour la Horde : 1 slot charge (actif = ≥1 unité depuis cette caserne)
// Pour les Nains : 2 slots golem
const myUnits    = computed(() => game.landUnits.filter(u => u.playerId === me.value?.id && u.barracksKey === barracksKey.value).length);
const slotUsed   = computed(() => isHorde.value ? (myUnits.value > 0 ? 1 : 0) : myUnits.value);
const slotMax    = computed(() => isHorde.value ? 1 : 2);
const unitsFull  = computed(() => slotUsed.value >= slotMax.value);
const canAfford  = computed(() => (me.value?.resources.wood ?? 0) >= 15 && (me.value?.resources.stone ?? 0) >= 10);
const canBuy     = computed(() => !unitsFull.value && canAfford.value);
const unitLabel  = computed(() => isHorde.value ? "Charge de cavalerie" : "Golem");
const unitDesc   = computed(() => isHorde.value ? "3 cavaliers · 5 cases" : "");
const unitIcon   = computed(() => isHorde.value ? "🏇" : "🗿");

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
        Caserne · {{ slotUsed }}/{{ slotMax }}
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
          <span v-if="unitDesc" class="text-[10px] text-[#f2ca50]/70">{{ unitDesc }}</span>
          <span class="text-[10px] text-white/40">
            {{ unitsFull ? (isHorde ? 'En charge — attendez' : 'Maximum atteint') : '15🪵 10🪨' }}
          </span>
        </div>
      </button>

    </div>
  </div>
</template>
