<script setup lang="ts">
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";

defineProps<{
  state: GameStateSnapshot | null;
  selected: BuildingType | null;
}>();

const emit = defineEmits<{ (e: "select", building: BuildingType | null): void }>();

const items: Array<{
  type: BuildingType | null;
  label: string;
  icon: string;
  cost: string;
  hint: string;
}> = [
  { type: null, label: "Territoire vide", icon: "flag", cost: "Coût: 1 militaire", hint: "Revendiquer une case neutre adjacente" },
  { type: BuildingType.FishingHut, label: "Cabane de pêche", icon: "sailing", cost: "Coût: 5 bois", hint: "Adjacente à l'eau" },
  { type: BuildingType.Sawmill, label: "Scierie", icon: "forest", cost: "Coût: 5 bois", hint: "Adjacente à une forêt" },
  { type: BuildingType.Mine, label: "Mine", icon: "construction", cost: "Coût: 5 bois", hint: "Adjacente à une carrière" },
  { type: BuildingType.Barracks, label: "Caserne", icon: "shield", cost: "Coût: 20 bois + 10 pierre", hint: "Sur une case possédée" },
  { type: BuildingType.University, label: "Université", icon: "history_edu", cost: "Coût: 20 bois + 20 pierre", hint: "Sur une case possédée" }
];
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <button
      v-for="b in items"
      :key="b.type ?? 'claim'"
      class="rf-parchment group flex flex-col items-center justify-center rounded-sm border-2 border-[#8b7e66] p-4 shadow-md transition-all hover:brightness-105 active:scale-95"
      :class="selected === b.type ? 'ring-2 ring-inset ring-[#f2ca50]' : ''"
      type="button"
      @click="emit('select', b.type)"
    >
      <span class="material-symbols-outlined rf-parchment-icon mb-2 text-3xl transition-transform group-hover:scale-110" aria-hidden="true">
        {{ b.icon }}
      </span>
      <span class="rf-parchment-title text-center text-[10px] font-bold uppercase">{{ b.label }}</span>
      <span class="mt-1 text-center text-[10px] text-black/70">{{ b.cost }}</span>
      <span class="mt-1 text-center text-[9px] text-black/60 italic">{{ b.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.rf-parchment {
  background-color: #d2c5b3;
  background-image: url("https://www.transparenttextures.com/patterns/paper-fibers.png");
  color: #2c241a;
}

.rf-parchment-icon {
  color: #4d3f2f;
}

.rf-parchment-title {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  letter-spacing: 0.1em;
}
</style>

