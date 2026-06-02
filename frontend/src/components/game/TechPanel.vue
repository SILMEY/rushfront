<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { BuildingType } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { useGameStore } from "../../stores/gameStore";
import { getSocket } from "../../composables/useSocket";

type TechDef = { id: string; name: string; description: string; cost: { wood: number; stone: number } };

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
    socket.off("game:techs");
    socket.on("game:techs", ({ techs: t }: { techs: TechDef[] }) => {
      techs.value = t;
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
</script>

<template>
  <div v-if="state && me && hasUniversity" class="rounded-xl border border-white/10 bg-white/5 p-4">
    <div class="flex items-center justify-between">
      <div class="font-semibold">Technologies</div>
      <div class="text-xs text-slate-400">Université requise</div>
    </div>

    <div class="mt-3 grid gap-2">
      <div
        v-for="t in techs"
        :key="t.id"
        class="rounded-lg border border-white/10 bg-slate-950/40 p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-100">{{ t.name }}</div>
            <div class="mt-1 text-xs text-slate-400">{{ t.description }}</div>
            <div class="mt-2 text-xs text-slate-400 font-mono">🪵 {{ t.cost.wood }} • 🪨 {{ t.cost.stone }}</div>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span v-if="t.id === 'pont' && (me.bridgeCharges ?? 0) > 0" class="text-[10px] text-[#f2ca50]/70">
              {{ me.bridgeCharges }} charge{{ (me.bridgeCharges ?? 0) > 1 ? 's' : '' }}
            </span>
            <button
              class="h-9 shrink-0 rounded-md bg-white/5 px-3 text-sm ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
              :disabled="(t.id !== 'pont' && myTechs.has(t.id)) || me.resources.wood < t.cost.wood || me.resources.stone < t.cost.stone"
              @click="buy(t.id)"
            >
              {{ t.id !== 'pont' && myTechs.has(t.id) ? "Acheté" : "Acheter" }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="techs.length === 0" class="text-xs text-slate-400">Chargement...</div>
    </div>
  </div>
</template>

