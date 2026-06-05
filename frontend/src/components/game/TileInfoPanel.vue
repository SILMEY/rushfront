<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { BuildingType, TileType } from "../../types/game";
import { tileAt } from "../../utils/tileUtils";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  state: GameStateSnapshot | null;
  hovered: Vec2 | null;
  selectedBuilding: BuildingType | null;
}>();

const { t } = useI18n();

const tile = computed(() => {
  if (!props.state || !props.hovered) return null;
  return tileAt(props.state, props.hovered.x, props.hovered.y);
});

function tileName(type: TileType) {
  if (type === TileType.Plain)  return t("tile_info.terrain_plain");
  if (type === TileType.Water)  return t("tile_info.terrain_water");
  if (type === TileType.Forest) return t("tile_info.terrain_forest");
  return t("tile_info.terrain_quarry");
}

function buildingName(b: BuildingType) {
  switch (b) {
    case BuildingType.Base:       return t("tile_info.building_base");
    case BuildingType.FishingHut: return t("tile_info.building_fishing_hut");
    case BuildingType.Sawmill:    return t("tile_info.building_sawmill");
    case BuildingType.Mine:       return t("tile_info.building_mine");
    case BuildingType.Barracks:   return t("tile_info.building_barracks");
    case BuildingType.University: return t("tile_info.building_university");
    case BuildingType.City:       return t("tile_info.building_city");
    case BuildingType.Wonder:     return t("tile_info.building_wonder");
    default:                      return String(b);
  }
}
</script>

<template>
  <div class="rounded-xl border border-white/10 bg-white/5 p-4">
    <div class="font-semibold">{{ t('tile_info.title') }}</div>
    <div v-if="!state || !hovered" class="mt-3 text-sm text-slate-400">{{ t('tile_info.hover_hint') }}</div>
    <div v-else class="mt-3 grid gap-2 text-sm">
      <div class="flex items-center justify-between">
        <div class="text-slate-300">{{ t('tile_info.coord_label') }}</div>
        <div class="font-mono">{{ hovered.x }}, {{ hovered.y }}</div>
      </div>
      <template v-if="tile">
        <div class="flex items-center justify-between">
          <div class="text-slate-300">{{ t('tile_info.type_label') }}</div>
          <div>{{ tileName(tile!.type) }}</div>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-slate-300">{{ t('tile_info.owner_label') }}</div>
          <div>{{ tile!.owner ? state.players.find((p) => p.id === tile!.owner)?.name ?? t('tile_info.owner_neutral') : t('tile_info.owner_neutral') }}</div>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-slate-300">{{ t('tile_info.building_label') }}</div>
          <div>{{ tile!.building ? buildingName(tile!.building) : t('tile_info.no_building') }}</div>
        </div>
      </template>
      <div class="mt-2 text-xs text-slate-400">{{ t('tile_info.game_hint') }}</div>
    </div>
  </div>
</template>
