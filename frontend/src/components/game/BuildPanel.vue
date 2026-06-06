<script setup lang="ts">
import { computed, ref } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import SectionTitle from "./SectionTitle.vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  state: GameStateSnapshot | null;
  selected: BuildingType | null;
}>();

const emit = defineEmits<{ (e: "select", building: BuildingType | null): void }>();

const auth = useAuthStore();
const me = computed(() => props.state?.players.find(p => p.userId === auth.user?.id) ?? null);
const { t } = useI18n();

const mySawmillCount = computed(() => {
  const state = props.state;
  const myId = me.value?.id;
  if (!state || !myId) return 0;
  let count = 0;
  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.buildings[i] === BuildingType.Sawmill && state.tiles.owners[i] === myId) count++;
  }
  return count;
});

const sawmillWoodCost = computed(() => mySawmillCount.value === 0 ? 5 : 10);

type BuildItem = {
  type: BuildingType | null;
  label: string;
  icon: string;
  wood: number;
  stone: number;
  villagers: number;
  hint?: string;
  production?: string;
};

const items = computed<BuildItem[]>(() => [
  { type: BuildingType.Sawmill,    label: "sawmill",    icon: "forest",        wood: sawmillWoodCost.value, stone: 0,   villagers: 0, production: "+30/min 🪵" },
  { type: BuildingType.Mine,       label: "mine",       icon: "construction",  wood: 10,  stone: 0,   villagers: 0, production: "+30/min 🪨" },
  { type: BuildingType.FishingHut, label: "fishing_hut",icon: "sailing",       wood: 10,  stone: 10,  villagers: 0 },
  { type: BuildingType.Barracks,   label: "barracks",   icon: "shield",        wood: 20,  stone: 10,  villagers: 0 },
  { type: BuildingType.University, label: "university", icon: "history_edu",   wood: 20,  stone: 20,  villagers: 0 },
  { type: BuildingType.City,       label: "city",       icon: "location_city", wood: 40,  stone: 80,  villagers: 0 },
  { type: BuildingType.Wonder,     label: "wonder",     icon: "temple_hindu",  wood: 150, stone: 300, villagers: 0 },
]);

const hoveredItem = ref<BuildItem | null>(null);
const tooltipStyle = ref<{ top: string; right: string } | null>(null);

function onPointerEnter(e: PointerEvent, b: BuildItem) {
  hoveredItem.value = b;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  tooltipStyle.value = {
    top: `${rect.top}px`,
    right: `${window.innerWidth - rect.left + 10}px`
  };
}

function canAfford(b: BuildItem): boolean {
  const player = me.value;
  if (!player) return false;
  if (b.type === null) return (player.resources.villagers ?? 0) >= 1;
  return player.resources.wood >= b.wood && player.resources.stone >= b.stone;
}

function costLabel(b: BuildItem): string {
  if (b.type === null) return t("build_panel.cost_villager");
  const parts: string[] = [];
  if (b.wood  > 0) parts.push(t("build_panel.cost_wood",  { n: b.wood }));
  if (b.stone > 0) parts.push(t("build_panel.cost_stone", { n: b.stone }));
  return parts.join(" + ") || t("build_panel.cost_free");
}

function buildLabel(b: BuildItem): string { return t(`build_panel.${b.label}`); }
function buildHint(b: BuildItem): string  { return t(`build_panel.${b.label}_hint`); }
</script>

<template>
  <div class="grid grid-cols-4 gap-1.5">
    <div
      v-for="b in items"
      :key="b.type ?? 'claim'"
    >
      <button
        class="w-full aspect-square rf-parchment flex flex-col items-center justify-center rounded border transition-all"
        :class="[
          selected === b.type
            ? 'border-[#f2ca50] ring-1 ring-inset ring-[#f2ca50] brightness-110'
            : 'border-[#8b7e66]',
          !canAfford(b)
            ? 'opacity-35 cursor-not-allowed'
            : 'hover:brightness-110 active:scale-95 cursor-pointer'
        ]"
        :disabled="!canAfford(b)"
        :aria-label="`${buildLabel(b)} — ${costLabel(b)}`"
        :aria-pressed="selected === b.type"
        type="button"
        @pointerenter="onPointerEnter($event, b)"
        @pointerleave="hoveredItem = null; tooltipStyle = null"
        @click="selected === b.type ? emit('select', null) : canAfford(b) && emit('select', b.type)"
      >
        <span
          :class="(b.icon.codePointAt(0) ?? 0) > 127 ? 'rf-parchment-icon text-2xl' : 'material-symbols-outlined rf-parchment-icon text-xl'"
          aria-hidden="true"
        >{{ b.icon }}</span>
        <span class="rf-parchment-title text-center text-[8px] font-bold uppercase leading-tight mt-0.5 px-0.5">{{ buildLabel(b) }}</span>
        <span v-if="b.production" class="text-[7px] text-[#a8c090]/80 font-mono leading-none mt-0.5">{{ b.production }}</span>
      </button>
    </div>
  </div>

  <!-- Tooltip en overlay (Teleport body pour éviter tout clipping) -->
  <Teleport to="body">
    <div
      v-if="hoveredItem && tooltipStyle"
      class="fixed z-[500] pointer-events-none w-52"
      :style="tooltipStyle"
    >
      <div class="rounded border border-[#8b7e66]/70 bg-[#1a1812] shadow-2xl px-3 py-2.5">
        <div class="rf-parchment-title text-[11px] font-bold uppercase text-[#f2ca50] mb-1">{{ buildLabel(hoveredItem) }}</div>
        <div class="text-[10px] text-white/55 italic mb-2 leading-snug">{{ buildHint(hoveredItem) }}</div>
        <div class="text-[10px] font-bold" :class="canAfford(hoveredItem) ? 'text-[#a8c090]' : 'text-red-400/80'">
          {{ costLabel(hoveredItem) }}
        </div>
        <div v-if="!canAfford(hoveredItem)" class="text-[9px] text-red-400/60 mt-0.5">{{ t('build_panel.insufficient') }}</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rf-parchment {
  background-color: #c8b99f;
  background-image: url("https://www.transparenttextures.com/patterns/paper-fibers.png");
  color: #2c241a;
}
.rf-parchment-icon { color: #4d3f2f; }
.rf-parchment-title {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  letter-spacing: 0.05em;
  color: #3a2e22;
}
</style>
