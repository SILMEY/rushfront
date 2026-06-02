<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";
import { useAuthStore } from "../stores/authStore";

const lobby = useLobbyStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const gameId = computed(() => String(route.params.id));
const current = computed(() => lobby.lobbies.find((l) => l.id === gameId.value) ?? null);
const me = computed(() => current.value?.players.find((p) => p.userId === auth.user?.id) ?? null);
const isHost = computed(() => current.value?.hostUserId === auth.user?.id);
const hostName = computed(() => current.value?.players.find((p) => p.userId === current.value?.hostUserId)?.name ?? "");

const MAX_PLAYERS = 10;

const CIVILIZATIONS = [
  {
    id: "iron_dwarves" as const,
    name: "Nains de Fer",
    icon: "🏔️",
    role: "Défense",
    bonus: "Pierre +éco · Défense ↑ · Attaque ↓"
  },
  {
    id: "sylvan_elves" as const,
    name: "Elfes Sylvains",
    icon: "🌲",
    role: "Équilibré",
    bonus: "Bois +éco · Équilibré"
  },
  {
    id: "steppe_horde" as const,
    name: "Horde des Steppes",
    icon: "⚔️",
    role: "Attaque",
    bonus: "Expansion rapide · Attaque ↑ · Défense ↓"
  },
  {
    id: "aurelian_empire" as const,
    name: "Empire d'Aurélien",
    icon: "🏛️",
    role: "Économie",
    bonus: "Routes · Territoire compact · Éco/case"
  }
];

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#a855f7",
  "#fde047",
  "#f97316",
  "#ffffff",
  "#22c55e",
  "#f472b6",
  "#06b6d4",
  "#e11d48"
];

const usedColors = computed(() => new Set((current.value?.players ?? []).map((p) => p.color)));
const readyCount = computed(() => current.value?.players.filter((p) => p.isReady).length ?? 0);

const shakeReady = ref(false);
function tryStartGame() {
  if (readyCount.value < 2) {
    shakeReady.value = false;
    requestAnimationFrame(() => { shakeReady.value = true; });
    setTimeout(() => { shakeReady.value = false; }, 600);
    return;
  }
  lobby.startGame(gameId.value);
}

onMounted(async () => {
  await lobby.ensureConnected();
  await lobby.joinLobby(gameId.value);
});

watch(
  () => lobby.lastStartedGameId,
  (id) => {
    if (id === gameId.value) router.push(`/game/${id}`);
  }
);
</script>

<template>
  <div class="rf-lobby relative">
    <div class="mx-auto w-full max-w-7xl px-container-margin py-6">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-xs font-headline font-bold uppercase tracking-[0.3em] text-primary/80">War Room</div>
          <h1 class="mt-2 text-4xl font-headline font-extrabold uppercase tracking-[0.12em] text-primary">
            Partie de {{ hostName || "..." }}
          </h1>
          <div class="mt-2 text-xs uppercase tracking-[0.25em] text-secondary/60">ID: {{ gameId }}</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
            @click="router.push('/')"
          >
            Retour
          </button>
          <button
            class="rounded-md border border-outline-variant/30 bg-black/40 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/80 transition hover:bg-black/60 hover:text-secondary"
            @click="lobby.leaveLobby(gameId)"
          >
            Quitter
          </button>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-outline-variant/30 bg-black/30 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <div class="scroll-banner flex items-center justify-between gap-6 px-6 py-5">
          <div class="flex items-center gap-4">
            <div class="wax-seal">
              <span class="material-symbols-outlined text-white text-3xl">campaign</span>
            </div>
            <div>
              <div class="text-xs font-headline font-bold uppercase tracking-[0.25em] text-primary/80">Rassemblement</div>
              <div class="text-lg font-headline font-bold uppercase tracking-widest text-primary">Salon de jeu</div>
            </div>
          </div>
          <div
            :class="['text-[10px] font-bold uppercase tracking-[0.25em] transition-colors', shakeReady ? 'text-red-400 shake-alert' : 'text-secondary/60']"
          >
            Prêts requis: {{ readyCount }}/2
          </div>
        </div>

        <div class="grid gap-0 lg:grid-cols-12">
          <!-- Players list -->
          <div class="lg:col-span-8">
            <div class="custom-scrollbar max-h-[560px] overflow-auto p-6">
              <div class="grid gap-3">
                <div
                  v-for="p in current?.players ?? []"
                  :key="p.id"
                  class="scroll-banner flex items-center justify-between gap-6 p-6"
                >
                  <div class="flex items-center gap-6">
                    <img
                      v-if="p.avatarUrl"
                      :src="p.avatarUrl"
                      alt="Avatar"
                      class="h-20 w-20 border-4 border-outline/50 object-cover shadow-lg"
                    />
                    <div v-else class="iron-texture grid h-20 w-20 place-items-center text-xl font-headline text-secondary">
                      {{ p.name.slice(0, 2).toUpperCase() }}
                    </div>

                    <div>
                      <div class="text-3xl font-headline leading-none text-secondary-fixed">{{ p.name }}</div>
                      <div class="mt-1 text-sm italic text-secondary/70">Commandant</div>
                    </div>
                  </div>

                  <div class="flex items-center gap-8">
                    <div class="flex flex-col items-center">
                      <span class="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">Civilisation</span>
                      <span class="text-2xl">{{ CIVILIZATIONS.find(c => c.id === p.civilization)?.icon ?? "🏔️" }}</span>
                      <span class="mt-0.5 text-[10px] text-secondary/70">{{ CIVILIZATIONS.find(c => c.id === p.civilization)?.name ?? "?" }}</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <span class="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">Héraldique</span>
                      <div class="h-8 w-12 border-2 border-black/20 shadow-md" :style="{ background: p.color }"></div>
                    </div>
                    <div class="flex flex-col items-center gap-1">
                      <div class="wax-seal" :class="p.isReady ? '' : 'opacity-40 bg-zinc-700 grayscale border-zinc-900'">
                        <span class="material-symbols-outlined text-white text-3xl">
                          {{ p.isReady ? "check_circle" : "hourglass_empty" }}
                        </span>
                      </div>
                      <span class="text-[10px] font-bold uppercase tracking-widest" :class="p.isReady ? 'text-primary' : 'text-secondary-fixed-dim'">
                        {{ p.isReady ? "PRÊT" : "ATTENTE" }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  v-for="i in Math.max(0, MAX_PLAYERS - (current?.players?.length ?? 0))"
                  :key="`empty-${i}`"
                  class="flex cursor-default items-center justify-center gap-4 border-2 border-dashed border-outline-variant bg-black/40 p-8 text-secondary/50"
                >
                  <span class="material-symbols-outlined text-4xl">person_add</span>
                  <div class="text-center">
                    <div class="text-xl font-headline">Emplacement vide</div>
                    <div class="text-[10px] font-bold uppercase tracking-widest text-primary/60">En attente d'un allié</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="lg:col-span-4">
            <div class="border-t-2 border-outline-variant bg-black/60 p-6 lg:border-l-2 lg:border-t-0">
              <div class="grid gap-6">
                <div>
                  <h3 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                    <span class="material-symbols-outlined text-sm">castle</span>
                    Civilisation
                  </h3>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      v-for="civ in CIVILIZATIONS"
                      :key="civ.id"
                      class="flex flex-col items-start gap-0.5 border p-2.5 text-left transition-all duration-200 hover:border-primary/60 hover:bg-white/5"
                      :class="me?.civilization === civ.id
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant/30 bg-black/20'"
                      @click="lobby.setCivilization(gameId, civ.id)"
                    >
                      <span class="text-xl leading-none">{{ civ.icon }}</span>
                      <span class="mt-1 text-[11px] font-bold leading-tight" :class="me?.civilization === civ.id ? 'text-primary' : 'text-secondary'">{{ civ.name }}</span>
                      <span class="text-[9px] uppercase tracking-widest" :class="me?.civilization === civ.id ? 'text-primary/70' : 'text-secondary/50'">{{ civ.role }}</span>
                    </button>
                  </div>
                  <p v-if="me?.civilization" class="mt-2 text-[10px] italic text-secondary/60">
                    {{ CIVILIZATIONS.find(c => c.id === me?.civilization)?.bonus }}
                  </p>
                </div>

                <div>
                  <h3 class="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                    <span class="material-symbols-outlined text-sm">palette</span>
                    Couleur d'héraldique
                  </h3>
                  <div class="flex flex-wrap gap-3">
                    <button
                      v-for="c in COLORS"
                      :key="c"
                      class="h-10 w-10 border-2 border-black/20 shadow-md transition-all hover:scale-110 disabled:opacity-30"
                      :style="{ background: c }"
                      :disabled="usedColors.has(c) && c !== me?.color"
                      :class="me?.color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''"
                      @click="lobby.setColor(gameId, c)"
                    />
                  </div>
                </div>

                <div class="flex flex-col justify-center">
                  <button
                    v-if="me"
                    class="h-16 w-full overflow-hidden rounded-md border border-outline-variant/50 bg-black/30 text-on-surface shadow-xl transition-all hover:brightness-110 active:scale-95"
                    :class="me.isReady ? 'metallic-crest' : 'grayscale opacity-70'"
                    @click="lobby.setReady(gameId, !me.isReady)"
                  >
                    <span class="flex items-center justify-center gap-4 text-2xl font-headline">
                      <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1">
                        {{ me.isReady ? "verified" : "hourglass_bottom" }}
                      </span>
                      <span>{{ me.isReady ? "PRÊT" : "PAS PRÊT" }}</span>
                    </span>
                  </button>

                  <button
                    v-if="isHost"
                    class="mt-3 h-16 metallic-crest w-full rounded-md text-on-primary shadow-xl transition-all hover:brightness-110 active:scale-95"
                    @click="tryStartGame()"
                  >
                    <span class="flex items-center justify-center gap-4 text-2xl font-headline">
                      <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1">swords</span>
                      <span>Lancer la partie</span>
                    </span>
                  </button>
                  <p class="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-secondary-fixed-dim">
                    Préparez vos troupes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="pointer-events-none fixed bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-primary/40 to-transparent shadow-[0_-4px_20px_rgba(242,202,80,0.2)]"
    ></div>
  </div>
</template>

<style scoped>
.rf-lobby {
  --primary: #d4af37;
  --on-primary: #241a00;
  --secondary: #d4c59f;
  --secondary-fixed: #f1e1b9;
  --secondary-fixed-dim: rgba(212, 197, 159, 0.75);
  --outline: #99907c;
  --outline-variant: #4d4635;
  --background: #131312;
  --container-margin: 24px;
}

.px-container-margin {
  padding-left: var(--container-margin);
  padding-right: var(--container-margin);
}

.text-primary {
  color: var(--primary);
}
.text-on-primary {
  color: var(--on-primary);
}
.text-secondary {
  color: var(--secondary);
}
.text-secondary-fixed {
  color: var(--secondary-fixed);
}
.text-secondary-fixed-dim {
  color: var(--secondary-fixed-dim);
}
.border-outline-variant {
  border-color: var(--outline-variant);
}
.border-outline-variant\/30 {
  border-color: rgba(77, 70, 53, 0.3);
}
.border-outline\/50 {
  border-color: rgba(153, 144, 124, 0.5);
}
.bg-background {
  background-color: var(--background);
}

.iron-texture {
  background-color: #1c1c1b;
  background-image: radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
  background-size: 4px 4px;
  border: 2px solid #353533;
  box-shadow: inset 0 0 10px #000, 4px 4px 0 #0e0e0d;
}

.scroll-banner {
  background: rgba(28, 28, 27, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid #d4af37;
  position: relative;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
}

.wax-seal {
  background: #920703;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.4);
  border: 2px solid #410000;
  transition: transform 0.2s;
}
.wax-seal:active {
  transform: scale(0.9);
}

.metallic-crest {
  background: linear-gradient(135deg, #f2ca50 0%, #d4af37 50%, #735c00 100%);
  border: 1px solid #ffe088;
  box-shadow: 0 0 10px rgba(242, 202, 80, 0.2);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #0e0e0d;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #52482b;
}

@keyframes shake {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(-6px); }
  30%  { transform: translateX(6px); }
  45%  { transform: translateX(-5px); }
  60%  { transform: translateX(5px); }
  75%  { transform: translateX(-3px); }
  90%  { transform: translateX(3px); }
  100% { transform: translateX(0); }
}
.shake-alert {
  animation: shake 0.55s ease;
}
</style>

