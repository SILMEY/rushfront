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

const portCount = computed(() => {
  const s = props.state;
  const player = me.value;
  if (!s || !player) return 0;
  return s.tiles.buildings.filter((b, i) => s.tiles.owners[i] === player.id && b === BuildingType.FishingHut).length;
});

const hasPort = computed(() => portCount.value > 0);

const fishingBoats    = computed(() => Object.values(me.value?.portFishingBoats ?? {}).reduce((s, n) => s + n, 0));
const maritimeCharges = computed(() => me.value?.maritimeCharges ?? 0);
const villagers       = computed(() => me.value?.resources.villagers ?? 0);
const wood            = computed(() => me.value?.resources.wood      ?? 0);
const stone           = computed(() => me.value?.resources.stone     ?? 0);

const maxFishingBoats = computed(() => portCount.value * 3);
const fishingBoatFull = computed(() => fishingBoats.value >= maxFishingBoats.value);
const fishingRate     = computed(() => (fishingBoats.value * 0.1).toFixed(1));

const myGalleons      = computed(() => game.galleons.filter(g => g.playerId === me.value?.id).length);
const maxGalleons     = computed(() => portCount.value * 2);
const galleonsFull    = computed(() => myGalleons.value >= maxGalleons.value);

function buyTransportBoat() { if (props.state) game.buyTransportBoat(props.state.gameId); }
const canBuyTransport = computed(() => villagers.value >= 10);
</script>

<template>
  <section v-if="hasPort" class="px-6 py-5 border-b-2 border-[#4d4635]">
    <SectionTitle>{{ t('port_panel.title') }}</SectionTitle>
    <div class="space-y-3 text-[11px]">

      <!-- Stats -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-white/50">
          <span>{{ t('port_panel.fishing_boats') }}</span>
          <div class="flex items-center gap-2">
            <span class="text-[9px] text-[#a8c090]/60 font-mono">{{ t('port_panel.fishing_rate', { n: fishingRate }) }}</span>
            <span class="font-bold text-[#a8c090]">{{ fishingBoats }}<span class="text-white/25 font-normal">/{{ maxFishingBoats }}</span></span>
          </div>
        </div>
        <div class="flex items-center justify-between text-white/50">
          <span>{{ t('port_panel.maritime_transports') }}</span>
          <span class="font-bold text-[#06b6d4]">{{ maritimeCharges }}</span>
        </div>
        <div class="flex items-center justify-between text-white/50">
          <span>Galions</span>
          <span class="font-bold text-[#f97316]">{{ myGalleons }}<span class="text-white/25 font-normal">/{{ maxGalleons }}</span></span>
        </div>
      </div>

      <!-- Boutons d'achat (transport global uniquement — fishing/galion via clic droit sur port) -->
      <div class="grid grid-cols-1 gap-2">
        <button
          class="flex flex-col items-center gap-1 rounded border py-2 px-1 transition-all duration-150"
          :class="canBuyTransport ? 'border-[#8b7e66] bg-[#1c1812]/80 hover:border-[#f2ca50] hover:bg-[#f2ca50]/5 cursor-pointer' : 'border-[#8b7e66]/20 bg-[#1c1812]/40 opacity-40 cursor-not-allowed'"
          :disabled="!canBuyTransport"
          @click="buyTransportBoat"
        >
          <span class="material-symbols-outlined text-[17px]" :class="canBuyTransport ? 'text-[#06b6d4]' : 'text-white/30'">directions_boat</span>
          <span class="text-[8px] font-bold uppercase tracking-wide" :class="canBuyTransport ? 'text-white/60' : 'text-white/20'">{{ t('port_panel.transport_btn') }}</span>
          <span class="text-[7px]" :class="canBuyTransport ? 'text-[#a8c090]/70' : 'text-white/15'">{{ t('port_panel.transport_cost') }}</span>
        </button>
      </div>
      <p class="text-[8px] text-white/25 text-center">{{ t('port_panel.click_port_hint') }}</p>
    </div>
  </section>
</template>
