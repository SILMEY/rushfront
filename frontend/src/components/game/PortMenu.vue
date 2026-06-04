<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

const props = defineProps<{
  state: GameStateSnapshot;
  tile: Vec2;
  clientX: number;
  clientY: number;
}>();

const emit = defineEmits<{
  (e: "buy-fishing-boat"): void;
  (e: "buy-transport-boat"): void;
  (e: "maritime-landing"): void;
  (e: "close"): void;
}>();

const auth    = useAuthStore();
const me      = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);
const villagers       = computed(() => me.value?.resources.villagers ?? 0);
const fishingBoats    = computed(() => me.value?.fishingBoats ?? 0);
const maritimeCharges = computed(() => me.value?.maritimeCharges ?? 0);

// Keep menu within viewport
const MARGIN = 120;
const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-[400]" @click="emit('close')" @contextmenu.prevent />

  <!-- Menu card -->
  <div
    class="fixed z-[401]"
    :style="{ left: cx + 'px', top: cy + 'px', transform: 'translate(-50%, -50%)' }"
  >
    <div class="bg-[#1c1812]/97 border border-[#8b7e66] rounded-lg shadow-2xl min-w-[200px] overflow-hidden">
      <!-- Header -->
      <div class="px-3 py-2 border-b border-[#8b7e66]/40 flex items-center gap-2">
        <span class="text-lg">⚓</span>
        <span class="text-[11px] font-bold uppercase tracking-widest text-[#d4af37]">Port</span>
        <div class="ml-auto flex gap-3 text-[10px] text-white/40">
          <span>🚣 {{ fishingBoats }}</span>
          <span>🚢 {{ maritimeCharges }}</span>
        </div>
      </div>

      <div class="p-2 space-y-1">
        <!-- Bateau de pêche -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-[11px] transition-all"
          :class="villagers >= 1
            ? 'text-[#d4c59f] hover:bg-white/8 cursor-pointer'
            : 'text-white/25 cursor-not-allowed'"
          :disabled="villagers < 1"
          @click.stop="emit('buy-fishing-boat')"
        >
          <span class="text-base leading-none">🚣</span>
          <div class="flex-1">
            <div class="font-bold">Bateau de pêche</div>
            <div class="text-[9px] text-[#a8c090]/60 font-mono">+18 bois/min</div>
          </div>
          <span class="text-white/40">1 hab.</span>
        </button>

        <!-- Transport maritime -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-[11px] transition-all"
          :class="villagers >= 10
            ? 'text-[#06b6d4] hover:bg-white/8 cursor-pointer'
            : 'text-white/25 cursor-not-allowed'"
          :disabled="villagers < 10"
          @click.stop="emit('buy-transport-boat')"
        >
          <span class="text-base leading-none">🚢</span>
          <span class="flex-1 font-bold">Transport maritime</span>
          <span class="text-white/40">10 hab.</span>
        </button>

        <!-- Débarquement (si charges disponibles) -->
        <button
          v-if="maritimeCharges > 0"
          class="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-[11px] transition-all border border-[#06b6d4]/30 text-[#06b6d4] hover:bg-[#06b6d4]/10 cursor-pointer"
          @click.stop="emit('maritime-landing')"
        >
          <span class="material-symbols-outlined text-[14px]">anchor</span>
          <span class="flex-1 font-bold">Débarquement</span>
          <span class="text-white/40">{{ maritimeCharges }}×</span>
        </button>
      </div>
    </div>
  </div>
</template>
