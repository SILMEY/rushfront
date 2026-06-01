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
  <div class="rf-game tactical-overlay min-h-[calc(100vh-56px)]">
    <div class="mx-auto grid max-w-7xl gap-6 px-container-margin py-6 lg:grid-cols-12">
      <!-- Map -->
      <main class="lg:col-span-8">
        <div class="rounded-md border-2 border-outline-variant bg-black/60 shadow-2xl">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-outline-variant bg-black/40 p-4">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary/60">Champ de bataille</div>
              <div class="mt-1 text-lg font-headline font-bold uppercase tracking-wide text-primary carved-text">Partie</div>
              <div class="mt-1 text-[10px] uppercase tracking-[0.25em] text-secondary/50">ID: {{ gameId }}</div>
            </div>
            <button
              class="rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
              @click="router.push('/')"
            >
              Accueil
            </button>
          </div>

          <div class="p-3">
            <div class="overflow-hidden rounded-md border-2 border-outline-variant bg-black">
              <GameCanvas
                class="h-[calc(100vh-220px)] min-h-[720px] w-full"
                :state="game.state"
                @tile-click="game.onTileClick"
              />
            </div>
          </div>
        </div>
      </main>

      <!-- Sidebar -->
      <aside class="lg:col-span-4">
        <div class="flex h-full flex-col overflow-hidden rounded-md border-2 border-outline-variant bg-black/60 shadow-2xl">
          <div class="wood-texture border-b-2 border-outline-variant p-5">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary/70">Interface</div>
                <div class="mt-1 text-2xl font-headline font-extrabold uppercase tracking-wide text-primary carved-text">
                  Commandement
                </div>
              </div>
              <span class="material-symbols-outlined text-primary/80" aria-hidden="true">shield</span>
            </div>
          </div>

          <div class="flex flex-1 flex-col gap-4 p-4">
            <!-- Resources -->
            <section class="stone-texture border-2 border-outline-variant p-4">
              <div class="mb-3 flex items-center justify-between">
                <div class="text-xs font-bold uppercase tracking-widest text-secondary/70">Ressources</div>
                <span class="material-symbols-outlined text-primary/60" aria-hidden="true">inventory_2</span>
              </div>
              <ResourceBar :state="game.state" />
            </section>

            <!-- Actions -->
            <section class="stone-texture border-2 border-outline-variant p-4">
              <div class="mb-3 flex items-center justify-between">
                <div class="text-xs font-bold uppercase tracking-widest text-secondary/70">Actions</div>
                <span class="material-symbols-outlined text-primary/60" aria-hidden="true">swords</span>
              </div>
              <BuildPanel :state="game.state" :selected="game.selectedBuilding" @select="game.selectedBuilding = $event" />
            </section>

            <!-- Tech -->
            <TechPanel :state="game.state" />
          </div>

          <div class="border-t-2 border-outline-variant bg-black/40 p-4">
            <div class="flex items-center gap-3">
              <div class="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_#f2ca50]"></div>
              <span class="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary/60">Connexion établie</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.rf-game {
  --primary: #d4af37;
  --on-primary: #241a00;
  --secondary: #d4c59f;
  --background: #131312;
  --outline-variant: #4d4635;
  --container-margin: 24px;
}

.px-container-margin {
  padding-left: var(--container-margin);
  padding-right: var(--container-margin);
}

.tactical-overlay {
  background-color: var(--background);
  background-image: radial-gradient(circle, #2a2a29 1px, transparent 1px);
  background-size: 32px 32px;
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

