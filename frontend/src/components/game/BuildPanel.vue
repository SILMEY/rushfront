<script setup lang="ts">
import { computed, ref } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import SectionTitle from "./SectionTitle.vue";

const props = defineProps<{
  state: GameStateSnapshot | null;
  selected: BuildingType | null;
}>();

const emit = defineEmits<{ (e: "select", building: BuildingType | null): void }>();

const auth = useAuthStore();
const me = computed(() => props.state?.players.find(p => p.userId === auth.user?.id) ?? null);

type BuildItem = {
  type: BuildingType | null;
  label: string;
  icon: string;
  wood: number;
  stone: number;
  villagers: number;
  hint: string;
  production?: string;  // short label shown inside the button
};

const items: BuildItem[] = [
  { type: BuildingType.Sawmill,    label: "Scierie",      icon: "🪚",            wood: 5,   stone: 0,   villagers: 0,
    hint: "Doit être adjacente à une forêt. Produit +30 bois/min par forêt adjacente (max 3 forêts = +90/min).",
    production: "+30/min 🪵" },
  { type: BuildingType.Mine,       label: "Mine",         icon: "⛏️",           wood: 10,  stone: 0,   villagers: 0,
    hint: "Doit être adjacente à une carrière. Produit +30 pierre/min par carrière adjacente (max 3 = +90/min).",
    production: "+30/min 🪨" },
  { type: BuildingType.FishingHut, label: "Port",         icon: "sailing",       wood: 10,  stone: 10,  villagers: 0,
    hint: "Adjacent à l'eau. Permet d'acheter des bateaux de pêche (+18 bois/min par bateau) et des transports maritimes." },
  { type: BuildingType.Barracks,   label: "Caserne",      icon: "shield",        wood: 20,  stone: 10,  villagers: 0,
    hint: "Débloque les militaires et les attaques" },
  { type: BuildingType.University, label: "Université",   icon: "history_edu",   wood: 20,  stone: 20,  villagers: 0,
    hint: "Débloque les recherches technologiques" },
  { type: BuildingType.City,       label: "Cité",         icon: "location_city", wood: 40,  stone: 80,  villagers: 0,
    hint: "+500 habitants maximum" },
  { type: BuildingType.Wonder,     label: "Merveille",    icon: "temple_hindu",  wood: 150, stone: 300, villagers: 0,
    hint: "Victoire si non prise en 10 minutes" },
];

const hoveredItem = ref<BuildItem | null>(null);
const tooltipStyle = ref<{ top: string; right: string } | null>(null);

function onMouseEnter(e: MouseEvent, b: BuildItem) {
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
  if (b.type === null) return "1 habitant";
  const parts: string[] = [];
  if (b.wood  > 0) parts.push(`${b.wood} bois`);
  if (b.stone > 0) parts.push(`${b.stone} pierre`);
  return parts.join(" + ") || "Gratuit";
}
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
        type="button"
        @mouseenter="onMouseEnter($event, b)"
        @mouseleave="hoveredItem = null; tooltipStyle = null"
        @click="canAfford(b) && emit('select', b.type)"
      >
        <span
          :class="(b.icon.codePointAt(0) ?? 0) > 127 ? 'rf-parchment-icon text-2xl' : 'material-symbols-outlined rf-parchment-icon text-xl'"
          aria-hidden="true"
        >{{ b.icon }}</span>
        <span class="rf-parchment-title text-center text-[8px] font-bold uppercase leading-tight mt-0.5 px-0.5">{{ b.label }}</span>
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
        <div class="rf-parchment-title text-[11px] font-bold uppercase text-[#f2ca50] mb-1">{{ hoveredItem.label }}</div>
        <div class="text-[10px] text-white/55 italic mb-2 leading-snug">{{ hoveredItem.hint }}</div>
        <div class="text-[10px] font-bold" :class="canAfford(hoveredItem) ? 'text-[#a8c090]' : 'text-red-400/80'">
          {{ costLabel(hoveredItem) }}
        </div>
        <div v-if="!canAfford(hoveredItem)" class="text-[9px] text-red-400/60 mt-0.5">Ressources insuffisantes</div>
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
