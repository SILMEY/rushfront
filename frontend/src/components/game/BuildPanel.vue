<script setup lang="ts">
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";

defineProps<{
  state: GameStateSnapshot | null;
  selected: BuildingType | null;
}>();

const emit = defineEmits<{ (e: "select", building: BuildingType | null): void }>();

const items: Array<{ type: BuildingType | null; name: string; cost: string; rule: string }> = [
  {
    type: null,
    name: "Revendiquer (⚑)",
    cost: "1 militaire",
    rule: "Clique une case neutre adjacente"
  },
  {
    type: BuildingType.FishingHut,
    name: "Cabane de pêche (P)",
    cost: "5 bois",
    rule: "Adjacente à l’eau"
  },
  { type: BuildingType.Sawmill, name: "Scierie (S)", cost: "5 bois", rule: "Adjacente à une forêt" },
  { type: BuildingType.Mine, name: "Mine (M)", cost: "5 bois", rule: "Adjacente à une carrière" },
  { type: BuildingType.Barracks, name: "Caserne (C)", cost: "20 bois + 10 pierre", rule: "Sur case possédée" },
  {
    type: BuildingType.University,
    name: "Université (U)",
    cost: "20 bois + 20 pierre",
    rule: "Sur case possédée"
  }
];
</script>

<template>
  <div class="rounded-xl border border-white/10 bg-white/5 p-4">
    <div class="flex items-center justify-between">
      <div class="font-semibold">Actions</div>
    </div>
    <div class="mt-3 grid gap-2">
      <button
        v-for="b in items"
        :key="b.type ?? 'claim'"
        class="rounded-lg border px-3 py-2 text-left transition"
        :class="selected === b.type ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 bg-slate-950/40 hover:bg-white/5'"
        @click="emit('select', b.type)"
      >
        <div class="text-sm font-semibold">{{ b.name }}</div>
        <div class="mt-1 text-xs text-slate-400">{{ b.cost }} • {{ b.rule }}</div>
      </button>
    </div>
    <div class="mt-3 text-xs text-slate-400">
      Note: construire plusieurs bâtiments dans le même tour est possible, mais tu dois avoir les ressources pour le total (ex: 2× scierie = 10 bois).
    </div>
  </div>
</template>
