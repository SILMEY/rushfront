<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

const props = defineProps<{
  state: GameStateSnapshot;
  tile: Vec2;
  clientX: number;
  clientY: number;
}>();

const emit = defineEmits<{
  (e: "buy-fishing-boat"): void;
  (e: "buy-transport-boat"): void;
  (e: "close"): void;
}>();

const auth = useAuthStore();
const me   = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);

type PortEntry = { action: "fishing-boat" | "transport"; label: string; icon: string; cost: number; detail: string };

const ALL: PortEntry[] = [
  { action: "fishing-boat", label: "Pêche",     icon: "sailing",          cost: 1,  detail: "+1 hab./s" },
  { action: "transport",    label: "Transport",  icon: "directions_boat",  cost: 10, detail: "1 débarquement" },
];

function canAfford(e: PortEntry): boolean {
  if (!me.value) return false;
  return me.value.resources.villagers >= e.cost;
}

function onAction(e: PortEntry) {
  if (!canAfford(e)) return;
  if (e.action === "fishing-boat") emit("buy-fishing-boat");
  else emit("buy-transport-boat");
}

const RADIUS   = 58;
const HALF_BTN = 24;
const MARGIN   = RADIUS + HALF_BTN + 6;

const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));

function itemStyle(i: number, total: number) {
  const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
  const x = Math.round(Math.cos(angle) * RADIUS);
  const y = Math.round(Math.sin(angle) * RADIUS);
  return { transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))` };
}
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-[400]" @click="emit('close')" @contextmenu.prevent />

  <!-- Menu -->
  <div class="fixed z-[401]" :style="{ left: cx + 'px', top: cy + 'px' }">

    <!-- Lignes SVG vers items -->
    <svg class="absolute overflow-visible pointer-events-none" style="transform: translate(-50%, -50%)" width="1" height="1">
      <line
        v-for="(item, i) in ALL"
        :key="'l' + item.action"
        x1="0" y1="0"
        :x2="Math.round(Math.cos((i / ALL.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
        :y2="Math.round(Math.sin((i / ALL.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
        stroke="rgba(242,202,80,0.18)"
        stroke-width="1"
      />
    </svg>

    <!-- Point central -->
    <div
      class="absolute w-2.5 h-2.5 rounded-full bg-[#f2ca50]/50 border border-[#f2ca50]/70 pointer-events-none"
      style="transform: translate(-50%, -50%)"
    />

    <!-- Items -->
    <div
      v-for="(entry, i) in ALL"
      :key="entry.action"
      class="absolute"
      :style="itemStyle(i, ALL.length)"
    >
      <button
        class="flex flex-col items-center gap-0.5 group"
        :disabled="!canAfford(entry)"
        @click.stop="onAction(entry)"
      >
        <div
          class="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-150 shadow-lg"
          :class="canAfford(entry)
            ? 'bg-[#1c1812]/95 border-[#8b7e66] group-hover:border-[#f2ca50] group-hover:scale-110'
            : 'bg-[#1c1812]/70 border-[#8b7e66]/25 opacity-40'"
        >
          <span
            class="material-symbols-outlined text-[19px]"
            :class="canAfford(entry) ? 'text-[#d4c59f]' : 'text-white/30'"
          >{{ entry.icon }}</span>
        </div>
        <span
          class="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap"
          :class="canAfford(entry) ? 'text-white/60' : 'text-white/20'"
        >{{ entry.label }}</span>
        <span
          class="text-[7px] whitespace-nowrap"
          :class="canAfford(entry) ? 'text-[#a8c090]/70' : 'text-white/15'"
        >{{ entry.detail }}</span>
      </button>
    </div>
  </div>
</template>
