<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { getSocket } from "../composables/useSocket";
import GameCanvas from "../components/game/GameCanvas.vue";
import BuildPanel from "../components/game/BuildPanel.vue";
import ResourceBar from "../components/game/ResourceBar.vue";
import TopResourceBar from "../components/game/TopResourceBar.vue";
import TechPanel from "../components/game/TechPanel.vue";
import CompositionPanel from "../components/game/CompositionPanel.vue";
import { useGameStore } from "../stores/gameStore";

const route  = useRoute();
const router = useRouter();
const game   = useGameStore();
const auth   = useAuthStore();
const gameId = computed(() => String(route.params.id));

const mePlayer   = computed(() => game.mePlayer);
const isWinner   = computed(() => game.gameOver?.winnerId === mePlayer.value?.id);
const isEliminated = computed(() => mePlayer.value?.eliminated === true);

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

        <!-- Victoire -->
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

        <!-- Défaite -->
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

        <!-- Spectateur — quelqu'un a gagné -->
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

<!-- MAIN GAMEPLAY CANVAS (layout inspired by `public/codejeu.html`) -->
  <div class="rf-game">
    <main class="tactical-overlay flex h-[calc(100vh-64px)] flex-col overflow-hidden pr-80">
      <!-- Resource Bar (Wooden Beam) -->
      <div class="z-10">
        <TopResourceBar :state="game.state" />
      </div>

      <!-- Grid Area -->
      <div class="relative flex-1 overflow-auto bg-stone-950 p-4">
        <div class="min-h-full min-w-max border-4 border-outline-variant bg-stone-900/40 shadow-2xl">
          <GameCanvas class="h-[calc(100vh-170px)] min-h-[720px] w-full" :state="game.state" @tile-click="game.onTileClick" @tile-dblclick="game.setExpandTarget" />
        </div>
      </div>
    </main>

    <!-- RIGHT PANEL -->
    <aside class="stone-texture fixed right-0 top-16 z-40 flex h-[calc(100vh-64px)] w-80 flex-col border-l-4 border-outline-variant">
      <div class="border-b-2 border-outline-variant bg-black/20 p-6">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-headline text-2xl font-bold uppercase text-primary carved-text">Poste de Contrôle</h2>
          <span class="material-symbols-outlined text-primary" aria-hidden="true">radar</span>
        </div>
        <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface/50 italic">Imperial Management Console</p>
      </div>

      <div class="flex-1 space-y-6 overflow-y-auto bg-black/10 p-6">
        <section>
          <CompositionPanel :state="game.state" />

          <h3 class="font-label-sm text-primary mb-4 flex items-center gap-2 carved-text">
            <span class="w-2 h-2 bg-primary rotate-45"></span> CONSTRUCTION
          </h3>
          <BuildPanel :state="game.state" :selected="game.selectedBuilding" @select="game.selectedBuilding = $event" />
        </section>

        <TechPanel :state="game.state" />

      </div>

      <div class="border-t-2 border-outline-variant bg-black/40 p-6">
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

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.text-primary {
  color: var(--primary);
}
.text-secondary {
  color: var(--secondary);
}
.text-on-primary {
  color: var(--on-primary);
}
.border-outline-variant {
  border-color: var(--outline-variant);
}
</style>
