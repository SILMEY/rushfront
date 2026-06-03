<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

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
};

const items: BuildItem[] = [
  { type: null,                    label: "Territoire",   icon: "flag",          wood: 0,   stone: 0,  villagers: 1,  hint: "Revendiquer une case neutre adjacente" },
  { type: BuildingType.FishingHut, label: "Cabane pêche", icon: "sailing",       wood: 5,   stone: 0,  villagers: 0,  hint: "Doit être adjacente à une case d'eau" },
  { type: BuildingType.Sawmill,    label: "Scierie",      icon: "forest",        wood: 5,   stone: 0,  villagers: 0,  hint: "Doit être adjacente à une forêt" },
  { type: BuildingType.Mine,       label: "Mine",         icon: "construction",  wood: 10,  stone: 0,  villagers: 0,  hint: "Doit être adjacente à une carrière" },
  { type: BuildingType.Barracks,   label: "Caserne",      icon: "shield",        wood: 20,  stone: 10, villagers: 0,  hint: "Débloque les militaires et les attaques" },
  { type: BuildingType.University, label: "Université",   icon: "history_edu",   wood: 20,  stone: 20, villagers: 0,  hint: "Débloque les recherches technologiques" },
  { type: BuildingType.City,       label: "Cité",         icon: "location_city", wood: 40,  stone: 80, villagers: 0,  hint: "+200 habitants maximum" },
  { type: BuildingType.Wonder,     label: "Merveille",    icon: "temple_hindu",  wood: 150, stone: 300,villagers: 0,  hint: "Victoire si non prise en 10 minutes" },
];

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
      class="group relative"
    >
      <!-- Bouton icône compact -->
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
        @click="canAfford(b) && emit('select', b.type)"
      >
        <span class="material-symbols-outlined rf-parchment-icon text-xl" aria-hidden="true">{{ b.icon }}</span>
        <span class="rf-parchment-title text-center text-[8px] font-bold uppercase leading-tight mt-0.5 px-0.5">{{ b.label }}</span>
      </button>

      <!-- Tooltip au hover (à gauche du panneau) -->
      <div
        class="pointer-events-none absolute right-full top-0 z-50 mr-2 hidden w-48 group-hover:block"
      >
        <div class="rounded border border-[#8b7e66]/60 bg-[#1c1a14] shadow-xl px-3 py-2.5">
          <div class="rf-parchment-title text-[11px] font-bold uppercase text-[#f2ca50] mb-1">{{ b.label }}</div>
          <div class="text-[10px] text-white/60 italic mb-2 leading-snug">{{ b.hint }}</div>
          <div class="text-[10px] font-bold" :class="canAfford(b) ? 'text-[#a8c090]' : 'text-red-400/80'">
            {{ costLabel(b) }}
          </div>
          <div v-if="!canAfford(b)" class="text-[9px] text-red-400/60 mt-0.5">Ressources insuffisantes</div>
        </div>
      </div>
    </div>
  </div>
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
