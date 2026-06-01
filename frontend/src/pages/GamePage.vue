<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GameCanvas from "../components/game/GameCanvas.vue";
import BuildPanel from "../components/game/BuildPanel.vue";
import ResourceBar from "../components/game/ResourceBar.vue";
import TechPanel from "../components/game/TechPanel.vue";
import { useGameStore } from "../stores/gameStore";

const route = useRoute();
const router = useRouter();
const game = useGameStore();
const gameId = computed(() => String(route.params.id));

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
  <!-- MAIN GAMEPLAY CANVAS (layout inspired by `public/codejeu.html`) -->
  <div class="rf-game">
    <main class="tactical-overlay flex h-[calc(100vh-64px)] flex-col overflow-hidden pr-80">
      <!-- Resource Bar (Wooden Beam) -->
      <div class="wood-texture etched-line z-10 flex h-14 w-full shrink-0 items-center justify-between gap-6 border-b-2 border-outline-variant px-6 shadow-xl">
        <div>
          <div class="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-secondary/70">Champ de bataille</div>
          <div class="mt-0.5 text-[10px] uppercase tracking-[0.25em] text-secondary/50">ID: {{ gameId }}</div>
        </div>
        <div class="flex-1">
          <ResourceBar :state="game.state" />
        </div>
        <button
          class="rounded-md border border-primary/30 px-3 py-1.5 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
          @click="router.push('/')"
        >
          Accueil
        </button>
      </div>

      <!-- Grid Area -->
      <div class="relative flex-1 overflow-auto bg-stone-950 p-4">
        <div class="min-h-full min-w-max border-4 border-outline-variant bg-stone-900/40 shadow-2xl">
          <GameCanvas class="h-[calc(100vh-170px)] min-h-[720px] w-full" :state="game.state" @tile-click="game.onTileClick" />
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
          <h3 class="carved-text mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <span class="h-2 w-2 rotate-45 bg-primary"></span>
            Actions
          </h3>
          <BuildPanel :state="game.state" :selected="game.selectedBuilding" @select="game.selectedBuilding = $event" />
        </section>

        <TechPanel :state="game.state" />

        <section class="mt-auto">
          <div class="group relative aspect-video w-full overflow-hidden border-2 border-outline-variant bg-black shadow-2xl">
            <img
              class="h-full w-full object-cover opacity-40 sepia-[0.3] transition-transform duration-[2s] group-hover:scale-110"
              src="/rf.png"
              alt="Tactical preview"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent"></div>
            <div class="absolute bottom-3 left-3 flex items-center gap-2">
              <span class="material-symbols-outlined animate-pulse text-[12px] text-primary" aria-hidden="true">explore</span>
              <span class="carved-text text-[9px] font-bold uppercase tracking-widest text-on-surface/80">Reconnaissance</span>
            </div>
          </div>
        </section>
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

