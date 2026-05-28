<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { tileAt } from "../../utils/tileUtils";

const props = defineProps<{
  state: GameStateSnapshot | null;
  hovered: Vec2 | null;
  selectedBuilding: BuildingType | null;
}>();

const tile = computed(() => {
  if (!props.state || !props.hovered) return null;
  return tileAt(props.state, props.hovered.x, props.hovered.y);
});

function tileName(t: TileType) {
  return t === TileType.Plain ? "Plaine" : t === TileType.Water ? "Eau" : t === TileType.Forest ? "Forêt" : "Carrière";
}
function buildingName(b: BuildingType) {
  return b === BuildingType.Base
    ? "Base (B)"
    : b === BuildingType.FishingHut
      ? "Pêche (P)"
      : b === BuildingType.Sawmill
        ? "Scierie (S)"
        : b === BuildingType.Mine
          ? "Mine (M)"
          : b === BuildingType.Barracks
            ? "Caserne (C)"
            : "Université (U)";
}
</script>

<template>
  <div class="rounded-xl border border-white/10 bg-white/5 p-4">
    <div class="font-semibold">Case</div>
    <div v-if="!state || !hovered" class="mt-3 text-sm text-slate-400">Survole une case de la carte.</div>
    <div v-else class="mt-3 grid gap-2 text-sm">
      <div class="flex items-center justify-between">
        <div class="text-slate-300">Coord</div>
        <div class="font-mono">{{ hovered.x }}, {{ hovered.y }}</div>
      </div>
      <template v-if="tile">
        <div class="flex items-center justify-between">
          <div class="text-slate-300">Type</div>
          <div>{{ tileName(tile!.type) }}</div>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-slate-300">Propriétaire</div>
          <div>{{ tile!.owner ? state.players.find((p) => p.id === tile!.owner)?.name ?? 'Joueur' : 'Neutre' }}</div>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-slate-300">Bâtiment</div>
          <div>{{ tile!.building ? buildingName(tile!.building) : '—' }}</div>
        </div>
      </template>
      <div class="mt-2 text-xs text-slate-400">
        Astuce: en phase placement, clique une plaine. En jeu, clique pour revendiquer, ou sélectionne un bâtiment puis clique pour construire.
      </div>
    </div>
  </div>
</template>
