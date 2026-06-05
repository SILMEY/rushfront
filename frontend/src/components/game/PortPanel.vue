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

const fishingBoats    = computed(() => me.value?.fishingBoats    ?? 0);
const maritimeCharges = computed(() => me.value?.maritimeCharges ?? 0);
const villagers       = computed(() => me.value?.resources.villagers ?? 0);

const maxFishingBoats = computed(() => portCount.value * 10);
const fishingBoatFull = computed(() => fishingBoats.value >= maxFishingBoats.value);

const canBuyFishing   = computed(() => !fishingBoatFull.value && villagers.value >= 1);
const canBuyTransport = computed(() => villagers.value >= 10);

function buyFishingBoat()   { if (props.state) game.buyFishingBoat(props.state.gameId); }
function buyTransportBoat() { if (props.state) game.buyTransportBoat(props.state.gameId); }
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
            <span class="text-[9px] text-[#a8c090]/60 font-mono">{{ t('port_panel.fishing_rate', { n: fishingBoats }) }}</span>
            <span class="font-bold text-[#a8c090]">{{ fishingBoats }}<span class="text-white/25 font-normal">/{{ maxFishingBoats }}</span></span>
          </div>
        </div>
        <div class="flex items-center justify-between text-white/50">
          <span>{{ t('port_panel.maritime_transports') }}</span>
          <span class="font-bold text-[#06b6d4]">{{ maritimeCharges }}</span>
        </div>
      </div>

      <!-- Boutons d'achat -->
      <div class="grid grid-cols-2 gap-2">

        <button
          class="flex flex-col items-center gap-1 rounded border py-2 px-1 transition-all duration-150"
          :class="canBuyFishing ? 'border-[#8b7e66] bg-[#1c1812]/80 hover:border-[#f2ca50] hover:bg-[#f2ca50]/5 cursor-pointer' : 'border-[#8b7e66]/20 bg-[#1c1812]/40 opacity-40 cursor-not-allowed'"
          :disabled="!canBuyFishing"
          @click="buyFishingBoat"
        >
          <span class="material-symbols-outlined text-[17px]" :class="canBuyFishing ? 'text-[#d4c59f]' : 'text-white/30'">sailing</span>
          <span class="text-[8px] font-bold uppercase tracking-wide" :class="canBuyFishing ? 'text-white/60' : 'text-white/20'">{{ t('port_panel.fishing_btn') }}</span>
          <span class="text-[7px]" :class="canBuyFishing ? 'text-[#a8c090]/70' : 'text-white/15'">
            {{ fishingBoatFull ? t('port_panel.max_reached') : t('port_panel.fishing_cost') }}
          </span>
        </button>

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
    </div>
  </section>
</template>
