<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { getSocket } from "../composables/useSocket";
import GameCanvas from "../components/game/GameCanvas.vue";
import BuildPanel from "../components/game/BuildPanel.vue";
import ResourceBar from "../components/game/ResourceBar.vue";
import TopResourceBar from "../components/game/TopResourceBar.vue";
import TechPanel from "../components/game/TechPanel.vue";
import CompositionPanel from "../components/game/CompositionPanel.vue";
import GameLeftPanel from "../components/game/GameLeftPanel.vue";
import PortPanel from "../components/game/PortPanel.vue";
import SectionTitle from "../components/game/SectionTitle.vue";
import RadialMenu    from "../components/game/RadialMenu.vue";
import PortMenu      from "../components/game/PortMenu.vue";
import MaritimeMenu  from "../components/game/MaritimeMenu.vue";
import { useGameStore } from "../stores/gameStore";

const route  = useRoute();
const router = useRouter();
const game   = useGameStore();
const auth   = useAuthStore();
const gameId = computed(() => String(route.params.id));

const mePlayer   = computed(() => game.mePlayer);
const isWinner   = computed(() => game.gameOver?.winnerId === mePlayer.value?.id);
const isEliminated = computed(() => mePlayer.value?.eliminated === true);

// Mobile panel toggles
const showLeft  = ref(false);
const showRight = ref(false);

function toggleLeft()  { showLeft.value  = !showLeft.value;  showRight.value = false; }
function toggleRight() { showRight.value = !showRight.value; showLeft.value  = false; }
function closeAll()    { showLeft.value  = false; showRight.value = false; }

async function surrender() {
  const socket = await getSocket();
  socket.emit("game:surrender", { gameId: gameId.value });
}

onMounted(async () => {
  await game.connect(gameId.value);
  await game.getState(gameId.value);
});

watch(
  () => gameId.value,
  async (id) => {
    await game.getState(id);
  }
);
</script>

<template>
  <!-- ── Overlay fin de partie ─────────────────────────── -->
  <Transition name="fade">
    <div v-if="game.gameOver" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div class="mx-4 max-w-md w-full rounded-2xl border p-10 text-center shadow-[0_0_80px_rgba(0,0,0,0.8)]"
           :class="isWinner
             ? 'border-[#d4af37]/60 bg-gradient-to-b from-[#1c1a0e] to-[#131312]'
             : 'border-white/10 bg-gradient-to-b from-[#1a1212] to-[#131312]'">

        <template v-if="isWinner">
          <div class="mb-2 text-6xl">🏆</div>
          <div class="text-xs font-headline font-bold uppercase tracking-[0.4em] text-[#d4af37]/70">Gloire à l'Empire</div>
          <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-tight text-[#d4af37] drop-shadow-[0_0_20px_rgba(212,175,55,0.5)]">
            Victoire !
          </h1>
          <p class="mt-4 text-sm italic text-[#d4c59f]/70">
            Tu as conquis le champ de bataille. Ton nom entre dans la légende.
          </p>
        </template>

        <template v-else-if="isEliminated">
          <div class="mb-2 text-6xl">⚔️</div>
          <div class="text-xs font-headline font-bold uppercase tracking-[0.4em] text-slate-400/70">Tombé au combat</div>
          <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-tight text-slate-300">
            Éliminé
          </h1>
          <p v-if="game.gameOver.winnerName" class="mt-4 text-sm italic text-slate-400">
            <span class="text-[#d4af37]">{{ game.gameOver.winnerName }}</span> remporte la bataille.
          </p>
        </template>

        <template v-else>
          <div class="mb-2 text-6xl">🏆</div>
          <h1 class="font-headline text-4xl font-extrabold uppercase text-[#d4af37]">Partie terminée</h1>
          <p v-if="game.gameOver.winnerName" class="mt-3 text-sm italic text-slate-400">
            <span class="text-[#d4af37]">{{ game.gameOver.winnerName }}</span> remporte la bataille.
          </p>
        </template>

        <button
          class="mt-8 w-full rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 py-3 font-headline text-sm font-bold uppercase tracking-widest text-[#d4af37] transition hover:bg-[#d4af37]/20"
          @click="router.push('/')"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  </Transition>

  <!-- Menu radial de construction -->
  <RadialMenu
    v-if="game.radialMenu && game.state"
    :state="game.state"
    :tile="game.radialMenu.tile"
    :client-x="game.radialMenu.clientX"
    :client-y="game.radialMenu.clientY"
    @build="(b) => { game.build(game.state!.gameId, game.radialMenu!.tile, b); game.radialMenu = null; }"
    @close="game.radialMenu = null"
  />

  <!-- Menu débarquement -->
  <MaritimeMenu
    v-if="game.maritimeMenu"
    :client-x="game.maritimeMenu.clientX"
    :client-y="game.maritimeMenu.clientY"
    @land="() => { game.maritimeLand(game.state!.gameId, game.maritimeMenu!.tile); game.maritimeMenu = null; }"
    @close="game.maritimeMenu = null"
  />

  <!-- Menu port -->
  <PortMenu
    v-if="game.portMenu && game.state"
    :state="game.state"
    :tile="game.portMenu.tile"
    :client-x="game.portMenu.clientX"
    :client-y="game.portMenu.clientY"
    @buy-fishing-boat="() => { game.buyFishingBoat(game.state!.gameId); game.portMenu = null; }"
    @buy-transport-boat="() => { game.buyTransportBoat(game.state!.gameId); game.portMenu = null; }"
    @close="game.portMenu = null"
  />

  <!-- ── Backdrop mobile (ferme les panneaux) ────────── -->
  <Transition name="fade">
    <div
      v-if="showLeft || showRight"
      class="fixed inset-0 z-[39] bg-black/60 md:hidden"
      aria-hidden="true"
      @click="closeAll"
    />
  </Transition>

  <!-- ── Boutons flottants mobile ─────────────────────── -->
  <div class="fixed bottom-6 left-4 z-[45] md:hidden">
    <button
      class="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900/95 border-2 border-[#4d4635] text-[#d4af37] shadow-xl transition-transform active:scale-90"
      :aria-expanded="showLeft"
      :aria-label="showLeft ? 'Fermer le panneau Informations' : 'Ouvrir le panneau Informations'"
      @click="toggleLeft"
    >
      <span class="material-symbols-outlined text-[22px]">{{ showLeft ? 'close' : 'leaderboard' }}</span>
    </button>
  </div>
  <div class="fixed bottom-6 right-4 z-[45] md:hidden">
    <button
      class="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900/95 border-2 border-[#4d4635] text-[#d4af37] shadow-xl transition-transform active:scale-90"
      :aria-expanded="showRight"
      :aria-label="showRight ? 'Fermer le Poste de Contrôle' : 'Ouvrir le Poste de Contrôle'"
      @click="toggleRight"
    >
      <span class="material-symbols-outlined text-[22px]">{{ showRight ? 'close' : 'radar' }}</span>
    </button>
  </div>

  <!-- ── Layout principal ─────────────────────────────── -->
  <div class="rf-game">

    <!-- Panneau gauche — drawer sur mobile, fixe sur desktop -->
    <GameLeftPanel
      :state="game.state"
      class="transition-transform duration-300 ease-in-out"
      :class="showLeft ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
      @close="showLeft = false"
    />

    <main class="tactical-overlay flex h-[calc(100vh-64px)] flex-col overflow-hidden md:pr-80 md:pl-72">
      <!-- Barre de ressources -->
      <div class="z-10">
        <TopResourceBar :state="game.state" />
      </div>

      <!-- Zone de jeu -->
      <div class="relative flex-1 overflow-auto bg-stone-950 p-2 md:p-4">
        <div class="min-h-full min-w-max border-4 border-outline-variant bg-stone-900/40 shadow-2xl">
          <GameCanvas
            class="h-[calc(100vh-140px)] min-h-[400px] md:h-[calc(100vh-170px)] md:min-h-[720px] w-full"
            :state="game.state"
            @tile-click="game.onTileClick"
            @tile-dblclick="game.onTileDblClick"
            @tile-context="(pos, cx, cy) => game.onTileContext(pos, cx, cy)"
          />
        </div>
      </div>
    </main>

    <!-- Panneau droit — drawer sur mobile, fixe sur desktop -->
    <aside
      class="stone-texture fixed right-0 top-16 z-40 flex h-[calc(100vh-64px)] w-[min(320px,100vw)] flex-col border-l-4 border-outline-variant transition-transform duration-300 ease-in-out"
      :class="showRight ? 'translate-x-0' : 'translate-x-full md:translate-x-0'"
      role="complementary"
      aria-label="Poste de Contrôle"
    >
      <div class="border-b-2 border-outline-variant bg-black/20 p-4 md:p-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-headline text-lg font-bold uppercase text-primary carved-text leading-tight">Poste de Contrôle</h2>
            <p class="text-[9px] font-bold uppercase tracking-widest text-on-surface/40 italic mt-0.5">Imperial Management Console</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary/70" aria-hidden="true">radar</span>
            <!-- Bouton fermeture mobile -->
            <button
              class="md:hidden flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white transition"
              aria-label="Fermer le Poste de Contrôle"
              @click="showRight = false"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto bg-black/10">

        <!-- Répartition -->
        <div class="px-4 md:px-6 py-5 border-b-2 border-outline-variant">
          <CompositionPanel :state="game.state" />
        </div>

        <!-- Construction -->
        <div class="px-4 md:px-6 py-5 border-b-2 border-outline-variant">
          <SectionTitle>Construction</SectionTitle>
          <BuildPanel :state="game.state" :selected="game.selectedBuilding" @select="game.selectBuilding($event)" />
        </div>

        <!-- Port (conditionnel) -->
        <PortPanel :state="game.state" />

        <!-- Technologies -->
        <TechPanel :state="game.state" />

      </div>

      <div class="border-t-2 border-outline-variant bg-black/40 p-4 md:p-6">
        <div class="flex items-center gap-3">
          <div class="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_#f2ca50]"></div>
          <span class="text-[10px] font-bold uppercase tracking-widest text-on-surface/40">Connection Established</span>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.rf-game {
  --primary: #d4af37;
  --on-primary: #241a00;
  --secondary: #d4c59f;
  --outline-variant: #4d4635;
  --background: #131312;
}

.tactical-overlay {
  background-color: var(--background);
  background-image: radial-gradient(circle, #2a2a29 1px, transparent 1px);
  background-size: 32px 32px;
}

.etched-line {
  box-shadow: inset 1px 1px 1px rgba(0, 0, 0, 0.4), 1px 1px 0px rgba(255, 255, 255, 0.05);
}

.wood-texture {
  background-color: #2b2319;
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.02) 0px, rgba(255, 255, 255, 0.02) 2px, transparent 2px, transparent 4px);
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.5);
}

.stone-texture {
  background-color: #353533;
  background-image: url("https://www.transparenttextures.com/patterns/asfalt-dark.png");
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.4);
}

.carved-text {
  text-shadow: -1px -1px 1px rgba(0, 0, 0, 0.8), 1px 1px 1px rgba(255, 255, 255, 0.1);
}

.font-label-sm {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.1em;
  font-weight: 700;
  text-transform: uppercase;
}

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

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.text-primary { color: var(--primary); }
.text-secondary { color: var(--secondary); }
.text-on-primary { color: var(--on-primary); }
.border-outline-variant { border-color: var(--outline-variant); }
</style>
