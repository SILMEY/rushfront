<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import { useI18n } from "vue-i18n";

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

const auth  = useAuthStore();
const game  = useGameStore();
const me    = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);
const { t } = useI18n();

const portKey = computed(() => `${props.tile.x}_${props.tile.y}`);

const portBoats   = computed(() => (me.value?.portFishingBoats ?? {})[portKey.value] ?? 0);
const portGalleons = computed(() => game.galleons.filter(g => g.playerId === me.value?.id && g.portKey === portKey.value).length);

type PortEntry = { action: "fishing-boat" | "transport" | "galleon"; label: string; icon: string; costLine: string; disabled: boolean };

const entries = computed((): PortEntry[] => {
  const r = me.value?.resources;
  const canFish    = portBoats.value < 3 && (r?.villagers ?? 0) >= 1 && (r?.wood ?? 0) >= 5;
  const canTransport = (r?.villagers ?? 0) >= 10;
  const canGalleon = portGalleons.value < 2 && (r?.wood ?? 0) >= 25 && (r?.stone ?? 0) >= 15;
  return [
    { action: "fishing-boat", label: t("port_menu.fishing_label"),   icon: "sailing",         costLine: portBoats.value >= 3 ? t("port_panel.max_reached") : t("port_menu.fishing_detail"),   disabled: !canFish },
    { action: "transport",    label: t("port_menu.transport_label"),  icon: "directions_boat", costLine: t("port_menu.transport_detail"), disabled: !canTransport },
    { action: "galleon",      label: "Galion",                        icon: "⚓",               costLine: portGalleons.value >= 2 ? t("port_panel.max_reached") : "25🪵 15🪨",               disabled: !canGalleon },
  ];
});

function onAction(e: PortEntry) {
  if (e.disabled) return;
  if (e.action === "fishing-boat") emit("buy-fishing-boat");
  else if (e.action === "transport") emit("buy-transport-boat");
  else if (e.action === "galleon") {
    if (props.state) game.buyGalleon(props.state.gameId, props.tile);
    emit("close");
  }
}

const RADIUS   = 68;
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

    <!-- Info port -->
    <div
      class="absolute pointer-events-none text-[8px] text-white/40 whitespace-nowrap"
      style="transform: translate(-50%, calc(-100% - 14px))"
    >⛵ {{ portBoats }}/3 &nbsp;·&nbsp; ⚓ {{ portGalleons }}/2</div>

    <!-- Lignes SVG vers items -->
    <svg class="absolute overflow-visible pointer-events-none" style="transform: translate(-50%, -50%)" width="1" height="1">
      <line
        v-for="(item, i) in entries"
        :key="'l' + item.action"
        x1="0" y1="0"
        :x2="Math.round(Math.cos((i / entries.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
        :y2="Math.round(Math.sin((i / entries.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
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
      v-for="(entry, i) in entries"
      :key="entry.action"
      class="absolute"
      :style="itemStyle(i, entries.length)"
    >
      <button
        class="flex flex-col items-center gap-0.5 group"
        :disabled="entry.disabled"
        @click.stop="onAction(entry)"
      >
        <div
          class="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-150 shadow-lg"
          :class="!entry.disabled
            ? 'bg-[#1c1812]/95 border-[#8b7e66] group-hover:border-[#f2ca50] group-hover:scale-110'
            : 'bg-[#1c1812]/70 border-[#8b7e66]/25 opacity-40'"
        >
          <span v-if="entry.icon.length > 2" class="text-[18px]">{{ entry.icon }}</span>
          <span v-else class="material-symbols-outlined text-[19px]" :class="!entry.disabled ? 'text-[#d4c59f]' : 'text-white/30'">{{ entry.icon }}</span>
        </div>
        <span
          class="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap"
          :class="!entry.disabled ? 'text-white/60' : 'text-white/20'"
        >{{ entry.label }}</span>
        <span
          class="text-[7px] whitespace-nowrap"
          :class="!entry.disabled ? 'text-[#a8c090]/70' : 'text-white/15'"
        >{{ entry.costLine }}</span>
      </button>
    </div>
  </div>
</template>
