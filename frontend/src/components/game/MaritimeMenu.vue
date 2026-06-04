<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ clientX: number; clientY: number }>();
const emit  = defineEmits<{ (e: "land"): void; (e: "close"): void }>();

const MARGIN = 70;
const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 z-[400]" @click="emit('close')" @contextmenu.prevent />

  <div class="fixed z-[401]" :style="{ left: cx + 'px', top: cy + 'px' }">
    <!-- Point central bleu -->
    <div
      class="absolute w-2.5 h-2.5 rounded-full bg-[#06b6d4]/50 border border-[#06b6d4]/70 pointer-events-none"
      style="transform: translate(-50%, -50%)"
    />

    <!-- Unique option positionnée au-dessus du point -->
    <div class="absolute" style="transform: translate(-50%, calc(-100% - 22px))">
      <button class="flex flex-col items-center gap-0.5 group" @click.stop="emit('land')">
        <div
          class="w-11 h-11 rounded-full border-2 flex items-center justify-center
                 transition-all duration-150 shadow-lg
                 bg-[#1c1812]/95 border-[#06b6d4]
                 group-hover:border-[#f2ca50] group-hover:scale-110"
        >
          <span class="material-symbols-outlined text-[19px] text-[#06b6d4] group-hover:text-[#f2ca50]">anchor</span>
        </div>
        <span class="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap text-white/60">
          Débarquement
        </span>
      </button>
    </div>
  </div>
</template>
