<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import SectionTitle from "./SectionTitle.vue";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth  = useAuthStore();
const game  = useGameStore();

const me = computed(() => props.state?.players.find(p => p.userId === auth.user?.id) ?? null);

const hasPort = computed(() => {
  const s = props.state;
  const player = me.value;
  if (!s || !player) return false;
  return s.tiles.buildings.some((b, i) => s.tiles.owners[i] === player.id && b === BuildingType.FishingHut);
});

const fishingBoats    = computed(() => me.value?.fishingBoats    ?? 0);
const maritimeCharges = computed(() => me.value?.maritimeCharges ?? 0);
const villagers       = computed(() => me.value?.resources.villagers ?? 0);

function buyFishingBoat()   { if (props.state) game.buyFishingBoat(props.state.gameId); }
function buyTransportBoat() { if (props.state) game.buyTransportBoat(props.state.gameId); }
</script>

<template>
  <section v-if="hasPort" class="px-6 py-5 border-b-2 border-[#4d4635]">
    <SectionTitle>Port</SectionTitle>

    <div class="space-y-1.5 text-[11px] mb-3">
      <div class="flex items-center justify-between text-white/50">
        <span>Bateaux de pêche</span>
        <div class="flex items-center gap-2">
          <span class="text-[9px] text-[#a8c090]/60 font-mono">+{{ fishingBoats }} hab./s</span>
          <span class="font-bold text-[#a8c090]">{{ fishingBoats }}</span>
        </div>
      </div>
      <div class="flex items-center justify-between text-white/50">
        <span>Transports maritimes</span>
        <span class="font-bold text-[#06b6d4]">{{ maritimeCharges }}</span>
      </div>
    </div>

    <div class="space-y-1.5">
      <button
        class="w-full rounded border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all text-left"
        :class="villagers >= 1
          ? 'border-[#8b7e66] text-[#d4c59f] hover:brightness-125 cursor-pointer'
          : 'border-[#8b7e66]/30 text-white/20 cursor-not-allowed'"
        :disabled="villagers < 1"
        @click="buyFishingBoat"
      >
        <span class="material-symbols-outlined text-[13px] align-middle mr-1">sailing</span>
        Bateau de pêche
        <span class="text-white/40 font-normal ml-1">(1 habitant → +bois/s)</span>
      </button>

      <button
        class="w-full rounded border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all text-left"
        :class="villagers >= 10
          ? 'border-[#06b6d4]/60 text-[#06b6d4] hover:brightness-125 cursor-pointer'
          : 'border-[#8b7e66]/30 text-white/20 cursor-not-allowed'"
        :disabled="villagers < 10"
        @click="buyTransportBoat"
      >
        <span class="material-symbols-outlined text-[13px] align-middle mr-1">directions_boat</span>
        Transport maritime
        <span class="text-white/40 font-normal ml-1">(10 habitants → 1 charge)</span>
      </button>

      <button
        v-if="maritimeCharges > 0"
        class="w-full rounded border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all"
        :class="game.maritimeLandingMode
          ? 'border-[#f2ca50] bg-[#f2ca50]/10 text-[#f2ca50]'
          : 'border-[#06b6d4]/60 text-[#06b6d4] hover:brightness-125'"
        @click="game.toggleMaritimeLanding()"
      >
        <span class="material-symbols-outlined text-[13px] align-middle mr-1">anchor</span>
        {{ game.maritimeLandingMode ? 'Annuler débarquement' : 'Débarquement maritime' }}
        <span v-if="!game.maritimeLandingMode" class="text-white/40 font-normal ml-1">({{ maritimeCharges }})</span>
      </button>
    </div>
  </section>
</template>
