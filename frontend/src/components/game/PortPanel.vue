<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import SectionTitle from "./SectionTitle.vue";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth  = useAuthStore();

const me = computed(() => props.state?.players.find(p => p.userId === auth.user?.id) ?? null);

const hasPort = computed(() => {
  const s = props.state;
  const player = me.value;
  if (!s || !player) return false;
  return s.tiles.buildings.some((b, i) => s.tiles.owners[i] === player.id && b === BuildingType.FishingHut);
});

const fishingBoats    = computed(() => me.value?.fishingBoats    ?? 0);
const maritimeCharges = computed(() => me.value?.maritimeCharges ?? 0);
</script>

<template>
  <section v-if="hasPort" class="px-6 py-5 border-b-2 border-[#4d4635]">
    <SectionTitle>Port</SectionTitle>
    <div class="space-y-1.5 text-[11px]">
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
      <p class="text-[9px] text-white/25 italic mt-1">Clic droit sur un port pour acheter · Clic droit sur une case côtière pour débarquer</p>
    </div>
  </section>
</template>
