<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import { getSocket } from "../../composables/useSocket";
import SectionTitle from "./SectionTitle.vue";

type TechDef = { id: string; name: string; description: string; cost: { wood: number; stone: number }; stackable?: boolean };

const props = defineProps<{ state: GameStateSnapshot | null }>();
const auth = useAuthStore();
const game = useGameStore();

const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);
const myTechs = computed(() => new Set(me.value?.techs ?? []));

const hasUniversity = computed(() => {
  const state = props.state;
  const player = me.value;
  if (!state || !player) return false;
  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if (state.tiles.owners[i] !== player.id) continue;
    if (state.tiles.buildings[i] === BuildingType.University) return true;
  }
  return false;
});

const techs = ref<TechDef[]>([]);
let techsRequested = false;

watch(
  () => props.state?.gameId,
  async (gameId) => {
    if (!gameId || techsRequested) return;
    techsRequested = true;
    const socket = await getSocket();
    socket.once("game:techs", ({ techs: list }: { techs: TechDef[] }) => {
      techs.value = list;
    });
    socket.emit("game:list_techs", { gameId });
  },
  { immediate: true }
);

async function buy(techId: string) {
  const state = props.state;
  if (!state) return;
  const socket = await getSocket();
  socket.emit("game:buy_tech", { gameId: state.gameId, techId });
}

function canAfford(t: TechDef) {
  return (me.value?.resources.wood ?? 0) >= t.cost.wood && (me.value?.resources.stone ?? 0) >= t.cost.stone;
}
function isBought(t: TechDef) {
  return !t.stackable && myTechs.value.has(t.id);
}
</script>

<template>
  <div v-if="state && me && hasUniversity" class="px-6 py-5">
    <SectionTitle>Technologies</SectionTitle>

    <div v-if="techs.length === 0" class="text-[10px] italic text-white/25 text-center py-2">
      Chargement…
    </div>

    <div class="space-y-2">
      <div
        v-for="t in techs"
        :key="t.id"
        class="rounded border px-3 py-2.5 transition-all"
        :class="isBought(t)
          ? 'border-[#d4af37]/30 bg-[#d4af37]/5'
          : 'border-[#8b7e66]/40 bg-black/20'"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-white/80 truncate">{{ t.name }}</div>
            <div class="text-[10px] text-white/40 italic leading-snug mt-0.5">{{ t.description }}</div>
            <div class="text-[10px] mt-1.5 space-x-2">
              <span v-if="t.cost.wood > 0" :class="(me?.resources.wood ?? 0) >= t.cost.wood ? 'text-[#a8c090]' : 'text-red-400/70'">
                {{ t.cost.wood }} bois
              </span>
              <span v-if="t.cost.stone > 0" :class="(me?.resources.stone ?? 0) >= t.cost.stone ? 'text-[#a8a090]' : 'text-red-400/70'">
                {{ t.cost.stone }} pierre
              </span>
              <span v-if="t.id === 'pont' && (me?.bridgeCharges ?? 0) > 0" class="text-[#f2ca50]/70">
                ({{ me?.bridgeCharges }} charge{{ (me?.bridgeCharges ?? 0) > 1 ? 's' : '' }})
              </span>
            </div>
          </div>
          <button
            class="shrink-0 rounded border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition-all mt-0.5"
            :class="isBought(t)
              ? 'border-[#d4af37]/30 text-[#d4af37]/50 cursor-default'
              : canAfford(t)
                ? 'border-[#8b7e66] text-[#d4c59f] hover:brightness-125 cursor-pointer'
                : 'border-[#8b7e66]/20 text-white/20 cursor-not-allowed'"
            :disabled="isBought(t) || !canAfford(t)"
            @click="!isBought(t) && buy(t.id)"
          >
            {{ isBought(t) ? '✓ Acheté' : 'Acheter' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #d4af37;
  text-shadow: -1px -1px 1px rgba(0,0,0,.8), 1px 1px 1px rgba(255,255,255,.1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.diamond {
  display: inline-block;
  width: 7px;
  height: 7px;
  background-color: #d4af37;
  transform: rotate(45deg);
  flex-shrink: 0;
}
</style>
