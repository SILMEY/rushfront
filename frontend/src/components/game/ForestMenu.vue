<script setup lang="ts">
import { computed } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";

const props = defineProps<{
  state: GameStateSnapshot;
  tile: Vec2;
  clientX: number;
  clientY: number;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const auth = useAuthStore();
const game = useGameStore();
const me   = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);

const cooldownEnds = computed(() => (me.value as any)?.cursedForestCooldownEnds ?? 0);
const onCooldown   = computed(() => Date.now() < cooldownEnds.value);
const remainingSec = computed(() => Math.max(0, Math.ceil((cooldownEnds.value - Date.now()) / 1000)));
const canCast      = computed(() => !onCooldown.value);

function cast() {
  if (!canCast.value) return;
  game.curseForest(props.state.gameId, props.tile);
  emit("close");
}

const MARGIN = 80;
const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));
</script>

<template>
  <div class="fixed inset-0 z-[400]" @click="emit('close')" @contextmenu.prevent />

  <div class="fixed z-[401] -translate-x-1/2 -translate-y-1/2" :style="{ left: cx + 'px', top: cy + 'px' }">
    <div class="rounded-lg border border-[#22c55e]/40 bg-[#0a1a0f]/95 shadow-2xl p-4 min-w-[180px]">

      <div class="text-[9px] uppercase tracking-widest text-[#22c55e]/50 mb-3 text-center font-bold">
        Forêt sylvaine
      </div>

      <button
        class="w-full flex items-center gap-3 rounded border py-2.5 px-3 transition-all"
        :class="canCast
          ? 'border-[#22c55e]/50 bg-[#0a1a0f]/60 hover:border-[#86efac] cursor-pointer'
          : 'border-[#22c55e]/15 bg-[#0a1a0f]/40 opacity-40 cursor-not-allowed'"
        :disabled="!canCast"
        @click.stop="cast"
      >
        <span class="text-2xl">🌿</span>
        <div class="flex flex-col items-start">
          <span class="text-[12px] font-bold text-[#86efac]">Forêt Maudite</span>
          <span class="text-[10px] text-[#22c55e]/50">
            {{ onCooldown ? `Recharge : ${remainingSec}s` : 'Cases ennemies adj. → toi' }}
          </span>
        </div>
      </button>

    </div>
  </div>
</template>
