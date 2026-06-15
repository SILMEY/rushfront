<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import SectionTitle from "./SectionTitle.vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth  = useAuthStore();
const game  = useGameStore();
const { t } = useI18n();

const me = computed(() => props.state?.players.find(p => p.userId === auth.user?.id) ?? null);
const hasPort = computed(() => ports.value.length > 0);

// Liste des ports du joueur avec position
const ports = computed(() => {
  const s = props.state;
  const player = me.value;
  if (!s || !player) return [];
  const result: Array<{ x: number; y: number; key: string }> = [];
  for (let i = 0; i < s.tiles.buildings.length; i++) {
    if (s.tiles.buildings[i] === BuildingType.FishingHut && s.tiles.owners[i] === player.id) {
      const x = i % s.width;
      const y = Math.floor(i / s.width);
      result.push({ x, y, key: `${x}_${y}` });
    }
  }
  return result;
});

// Données par port
function portData(portKey: string) {
  const player = me.value;
  const fishing   = (player?.portFishingBoats ?? {})[portKey] ?? 0;
  const transport = (player?.portTransports   ?? {})[portKey] ?? 0;
  const galleons  = game.galleons.filter(g => g.playerId === player?.id && g.portKey === portKey).length;
  return { fishing, transport, galleons };
}

const fishingRate = computed(() => {
  const total = Object.values(me.value?.portFishingBoats ?? {}).reduce((s, n) => s + n, 0);
  return (total * 0.1).toFixed(1);
});
</script>

<template>
  <section v-if="hasPort" class="px-6 py-5 border-b-2 border-[#4d4635]">
    <SectionTitle>{{ t('port_panel.title') }}</SectionTitle>

    <div class="space-y-2 text-[11px]">

      <!-- Un bloc par port -->
      <div
        v-for="port in ports"
        :key="port.key"
        class="rounded border border-[#4d4635]/50 bg-[#1a1508]/50 px-3 py-2"
      >
        <!-- En-tête port -->
        <div class="flex items-center gap-1.5 mb-1.5 text-[10px] text-white/35 font-mono">
          <span class="material-symbols-outlined text-[12px] text-[#d4af37]/50">anchor</span>
          {{ port.x }}, {{ port.y }}
        </div>
        <!-- Bateaux du port -->
        <div class="flex items-center gap-3">
          <!-- Pêche -->
          <div class="flex items-center gap-1">
            <span class="text-[13px]">⛵</span>
            <span class="font-bold text-[#a8c090]">{{ portData(port.key).fishing }}</span>
            <span class="text-white/25">/3</span>
          </div>
          <!-- Transport -->
          <div class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px] text-[#06b6d4]">directions_boat</span>
            <span class="font-bold text-[#06b6d4]">{{ portData(port.key).transport }}</span>
          </div>
          <!-- Galion -->
          <div class="flex items-center gap-1">
            <span class="text-[13px]">⛵</span>
            <span class="material-symbols-outlined text-[10px] text-[#f97316] -ml-1" style="font-size:9px">local_fire_department</span>
            <span class="font-bold text-[#f97316]">{{ portData(port.key).galleons }}</span>
            <span class="text-white/25">/2</span>
          </div>
        </div>
      </div>

      <!-- Taux de pêche global -->
      <div class="flex items-center justify-between text-white/35 text-[10px] pt-1">
        <span>{{ t('port_panel.fishing_rate', { n: fishingRate }) }}</span>
        <span class="text-white/25 text-[9px]">{{ t('port_panel.click_port_hint') }}</span>
      </div>

    </div>
  </section>
</template>
