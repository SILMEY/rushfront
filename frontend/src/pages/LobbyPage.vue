<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";
import { useAuthStore } from "../stores/authStore";
import ChatPanel from "../components/game/ChatPanel.vue";
import { useI18n } from "vue-i18n";

const lobby = useLobbyStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const gameId = computed(() => String(route.params.id));
const current = computed(() => lobby.lobbies.find((l) => l.id === gameId.value) ?? null);
const me = computed(() => current.value?.players.find((p) => p.userId === auth.user?.id) ?? null);
const isHost = computed(() => current.value?.hostUserId === auth.user?.id);
const hostName = computed(() => current.value?.players.find((p) => p.userId === current.value?.hostUserId)?.name ?? "");

const MAX_PLAYERS = 10;

const canAddBot = computed(() =>
  isHost.value && (current.value?.players.length ?? 0) < MAX_PLAYERS
);

const CIVILIZATIONS = [
  { id: "iron_dwarves" as const, name: "Nains de Fer", icon: "🏔️", role: "Défense", bonus: "Pierre ×2 · Défense ↑ · Attaque ↓" },
  { id: "sylvan_elves" as const, name: "Elfes Sylvains", icon: "🌲", role: "Équilibré", bonus: "Bois ×2 · Équilibré" },
  { id: "steppe_horde" as const, name: "Horde des Steppes", icon: "⚔️", role: "Attaque", bonus: "Expansion rapide · Attaque ↑ · Défense ↓" },
  { id: "aurelian_empire" as const, name: "Empire d'Aurélien", icon: "🏛️", role: "Économie", bonus: "Routes · Territoire compact · +éco/case" }
];

const COLORS = [
  "#3b82f6","#ef4444","#a855f7","#fde047","#f97316",
  "#ffffff","#22c55e","#f472b6","#06b6d4","#e11d48"
];

const usedColors = computed(() => new Set((current.value?.players ?? []).map((p) => p.color)));
const readyCount = computed(() => current.value?.players.filter((p) => p.isReady).length ?? 0);

const showCivModal = ref(false);
const showColorModal = ref(false);

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

watch(() => lobby.lastStartedGameId, (id) => {
  if (id === gameId.value) router.push(`/game/${id}`);
});

watch(() => lobby.lastError, (err) => {
  if (!err) return;
  if (err === "lobby_not_open") router.replace(`/game/${gameId.value}`);
  else if (err === "lobby_not_found" || err === "lobby_full") router.replace("/");
});

let leaving = false;

function quitLobby() {
  if (leaving) return;
  leaving = true;
  lobby.leaveLobby(gameId.value);
  router.push("/");
}

onBeforeRouteLeave(() => {
  if (!leaving && !lobby.lastStartedGameId) {
    leaving = true;
    lobby.leaveLobby(gameId.value);
  }
});
</script>

<template>
  <div class="rf-lobby relative">
    <div class="mx-auto w-full max-w-6xl px-container-margin py-6">

      <!-- Header -->
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-xs font-headline font-bold uppercase tracking-[0.3em] text-primary/80">{{ t('lobby.subtitle') }}</div>
          <h1 class="mt-2 text-4xl font-headline font-extrabold uppercase tracking-[0.12em] text-primary">
            {{ t('lobby.game_title', { host: hostName || '...' }) }}
          </h1>
          <div class="mt-2 text-xs uppercase tracking-[0.25em] text-secondary/60">{{ t('lobby.game_id', { id: gameId }) }}</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="isHost"
            class="metallic-crest h-12 rounded-md px-6 text-sm font-headline font-extrabold uppercase tracking-widest text-on-primary shadow-xl transition-all hover:brightness-110 active:scale-95"
            @click="tryStartGame()"
          >
            <span class="flex items-center gap-2">
              <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1">swords</span>
              {{ t('lobby.start_btn') }}
            </span>
          </button>
          <button
            class="rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
            @click="quitLobby()"
          >
            {{ t('lobby.quit_btn') }}
          </button>
        </div>
      </div>

      <!-- Contenu : chat + joueurs -->
      <div class="flex flex-col lg:flex-row gap-6 items-start">

        <!-- Chat panel -->
        <div class="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-20 overflow-hidden rounded-2xl border border-outline-variant/30 bg-black/30 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col h-64 lg:h-[520px]">
          <div class="scroll-banner flex items-center gap-3 px-4 py-3 shrink-0">
            <div>
              <div class="text-[10px] font-headline font-bold uppercase tracking-[0.25em] text-primary/80">{{ t('lobby.chat_section') }}</div>
              <div class="text-sm font-headline font-bold uppercase tracking-widest text-primary">{{ t('lobby.chat_title') }}</div>
            </div>
          </div>
          <div class="flex-1 min-h-0">
            <ChatPanel
              :game-id="gameId"
              event-name="lobby:chat"
              :my-name="auth.user?.pseudo ?? auth.user?.name ?? '?'"
              :my-color="me?.color ?? '#ffffff'"
            />
          </div>
        </div>

        <!-- Liste des joueurs (pleine largeur) -->
        <div class="flex-1 min-w-0">
          <div class="overflow-hidden rounded-2xl border border-outline-variant/30 bg-black/30 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <!-- Banner -->
            <div class="scroll-banner flex items-center justify-between gap-4 px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="wax-seal">
                  <span class="material-symbols-outlined text-white text-2xl">campaign</span>
                </div>
                <div>
                  <div class="text-[10px] font-headline font-bold uppercase tracking-[0.25em] text-primary/80">{{ t('lobby.gathering_label') }}</div>
                  <div class="text-base font-headline font-bold uppercase tracking-widest text-primary">{{ t('lobby.game_room_title') }}</div>
                </div>
              </div>
              <div :class="['text-[10px] font-bold uppercase tracking-[0.25em] transition-colors', shakeReady ? 'text-red-400 shake-alert' : 'text-secondary/60']">
                {{ t('lobby.ready_count', { count: readyCount }) }}
              </div>
            </div>

            <!-- Slots joueurs -->
            <div class="custom-scrollbar max-h-[520px] overflow-auto p-4">
              <div class="grid gap-2">
                <!-- Joueurs présents -->
                <div
                  v-for="p in current?.players ?? []"
                  :key="p.id"
                  class="scroll-banner flex items-center gap-4 p-3 sm:p-4"
                  :class="p.isBot ? 'opacity-80' : ''"
                >
                  <!-- Avatar -->
                  <div v-if="p.isBot" class="iron-texture grid h-12 w-12 shrink-0 place-items-center" :style="{ borderColor: p.color }">
                    <span class="material-symbols-outlined text-2xl" :style="{ color: p.color }">smart_toy</span>
                  </div>
                  <img v-else-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.name"
                    class="h-12 w-12 shrink-0 border-4 border-outline/50 object-cover shadow-lg" />
                  <div v-else class="iron-texture grid h-12 w-12 shrink-0 place-items-center text-sm font-headline text-secondary">
                    {{ p.name.slice(0, 2).toUpperCase() }}
                  </div>

                  <!-- Nom -->
                  <div class="flex-1 min-w-0">
                    <div class="text-base font-headline leading-none text-secondary-fixed truncate">{{ p.name }}</div>
                    <div class="mt-0.5 text-[10px] italic text-secondary/60">
                      {{ p.isBot ? t('lobby.bot_label') : t('lobby.commander_label') }}
                    </div>
                  </div>

                  <!-- Civilisation : cliquable si c'est moi -->
                  <button
                    v-if="p.userId === auth.user?.id"
                    class="flex flex-col items-center gap-0.5 rounded-md border border-outline-variant/30 bg-black/20 px-3 py-1.5 transition hover:border-primary/50 hover:bg-white/5"
                    :title="t('lobby.civilization_title')"
                    @click="showCivModal = true"
                  >
                    <span class="text-xl leading-none">{{ CIVILIZATIONS.find(c => c.id === p.civilization)?.icon ?? '🏔️' }}</span>
                    <span class="text-[9px] text-secondary/70">{{ CIVILIZATIONS.find(c => c.id === p.civilization)?.name }}</span>
                  </button>
                  <div v-else class="flex flex-col items-center gap-0.5 px-2">
                    <span class="text-xl leading-none">{{ CIVILIZATIONS.find(c => c.id === p.civilization)?.icon ?? '🏔️' }}</span>
                    <span class="text-[9px] text-secondary/70">{{ CIVILIZATIONS.find(c => c.id === p.civilization)?.name }}</span>
                  </div>

                  <!-- Couleur : cliquable si c'est moi -->
                  <button
                    v-if="p.userId === auth.user?.id"
                    class="h-8 w-8 shrink-0 border-2 border-black/30 shadow-md transition hover:scale-110 hover:ring-2 hover:ring-primary/60 hover:ring-offset-1 hover:ring-offset-black"
                    :style="{ background: p.color }"
                    :title="t('lobby.heraldry_label')"
                    @click="showColorModal = true"
                  />
                  <div v-else class="h-8 w-8 shrink-0 border-2 border-black/30 shadow-md" :style="{ background: p.color }" />

                  <!-- Prêt / bouton prêt si c'est moi -->
                  <button
                    v-if="p.userId === auth.user?.id"
                    class="flex shrink-0 flex-col items-center gap-0.5 rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
                    :class="me?.isReady
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-outline-variant/40 bg-black/20 text-secondary/60'"
                    @click="lobby.setReady(gameId, !me?.isReady)"
                  >
                    <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1">
                      {{ me?.isReady ? 'verified' : 'hourglass_bottom' }}
                    </span>
                    {{ me?.isReady ? t('lobby.ready') : t('lobby.not_ready') }}
                  </button>
                  <div v-else class="flex shrink-0 flex-col items-center gap-0.5 px-2">
                    <div class="wax-seal h-8 w-8" :class="p.isReady ? '' : 'opacity-30 bg-zinc-700 grayscale border-zinc-900'">
                      <span class="material-symbols-outlined text-white text-base">{{ p.isReady ? 'check_circle' : 'hourglass_empty' }}</span>
                    </div>
                  </div>

                  <!-- Supprimer bot (hôte) -->
                  <button
                    v-if="p.isBot && isHost"
                    class="shrink-0 rounded-md p-1.5 text-red-400/50 transition hover:bg-red-500/10 hover:text-red-400"
                    :title="t('lobby.bot_remove')"
                    @click="lobby.removeBot(gameId, p.id)"
                  >
                    <span class="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>

                <!-- Slots vides -->
                <div
                  v-for="i in Math.max(0, MAX_PLAYERS - (current?.players?.length ?? 0))"
                  :key="`empty-${i}`"
                  class="flex items-center justify-center border-2 border-dashed border-outline-variant/30 bg-black/20 p-5"
                >
                  <button
                    v-if="canAddBot"
                    class="flex items-center gap-2 rounded-md border border-outline-variant/40 bg-black/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/60 transition hover:border-primary/40 hover:text-primary active:scale-95"
                    @click="lobby.addBot(gameId)"
                  >
                    <span class="material-symbols-outlined text-base">smart_toy</span>
                    {{ t('lobby.bot_add') }}
                  </button>
                  <div v-else class="flex items-center gap-2 text-secondary/30">
                    <span class="material-symbols-outlined text-2xl">person_add</span>
                    <span class="text-xs font-headline uppercase tracking-widest">{{ t('lobby.empty_slot_subtitle') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Barre décorative bas -->
    <div class="pointer-events-none fixed bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-primary/40 to-transparent shadow-[0_-4px_20px_rgba(242,202,80,0.2)]"></div>

    <!-- Modal civilisation -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCivModal"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          @click.self="showCivModal = false"
        >
          <div class="w-full max-w-md rounded-2xl border border-[#4d4635] bg-stone-900 p-6 shadow-2xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-headline text-lg font-bold uppercase tracking-widest text-[#d4af37]">
                {{ t('lobby.civilization_title') }}
              </h2>
              <button class="text-[#d4c59f]/50 hover:text-[#d4c59f] transition" @click="showCivModal = false">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="civ in CIVILIZATIONS"
                :key="civ.id"
                class="flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all hover:border-[#d4af37]/60 hover:bg-white/5"
                :class="me?.civilization === civ.id
                  ? 'border-[#d4af37] bg-[#d4af37]/10'
                  : 'border-[#4d4635]/50 bg-black/20'"
                @click="lobby.setCivilization(gameId, civ.id); showCivModal = false"
              >
                <span class="text-3xl leading-none">{{ civ.icon }}</span>
                <span class="mt-1 text-sm font-bold leading-tight" :class="me?.civilization === civ.id ? 'text-[#d4af37]' : 'text-[#d4c59f]'">{{ civ.name }}</span>
                <span class="text-[10px] uppercase tracking-widest" :class="me?.civilization === civ.id ? 'text-[#d4af37]/70' : 'text-[#d4c59f]/50'">{{ civ.role }}</span>
                <span class="mt-1 text-[10px] italic text-[#d4c59f]/40 leading-tight">{{ civ.bonus }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal couleur -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showColorModal"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          @click.self="showColorModal = false"
        >
          <div class="w-full max-w-xs rounded-2xl border border-[#4d4635] bg-stone-900 p-6 shadow-2xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-headline text-lg font-bold uppercase tracking-widest text-[#d4af37]">
                {{ t('lobby.heraldry_title') }}
              </h2>
              <button class="text-[#d4c59f]/50 hover:text-[#d4c59f] transition" @click="showColorModal = false">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="flex flex-wrap gap-3 justify-center">
              <button
                v-for="c in COLORS"
                :key="c"
                class="h-12 w-12 border-2 border-black/20 shadow-md transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                :style="{ background: c }"
                :disabled="usedColors.has(c) && c !== me?.color"
                :class="me?.color === c ? 'ring-2 ring-[#d4af37] ring-offset-2 ring-offset-stone-900 scale-110' : ''"
                @click="lobby.setColor(gameId, c); showColorModal = false"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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
.px-container-margin { padding-left: var(--container-margin); padding-right: var(--container-margin); }
.text-primary { color: var(--primary); }
.text-on-primary { color: var(--on-primary); }
.text-secondary { color: var(--secondary); }
.text-secondary-fixed { color: var(--secondary-fixed); }
.text-secondary-fixed-dim { color: var(--secondary-fixed-dim); }
.border-outline-variant { border-color: var(--outline-variant); }
.border-outline-variant\/30 { border-color: rgba(77, 70, 53, 0.3); }
.border-outline\/50 { border-color: rgba(153, 144, 124, 0.5); }

.iron-texture {
  background-color: #1c1c1b;
  background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0);
  background-size: 4px 4px;
  border: 2px solid #353533;
  box-shadow: inset 0 0 10px #000, 4px 4px 0 #0e0e0d;
}

.scroll-banner {
  background: rgba(28, 28, 27, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid #d4af37;
  position: relative;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

.wax-seal {
  background: #920703;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 8px rgba(0,0,0,0.6), 2px 2px 4px rgba(0,0,0,0.4);
  border: 2px solid #410000;
  transition: transform 0.2s;
}
.wax-seal:active { transform: scale(0.9); }

.metallic-crest {
  background: linear-gradient(135deg, #f2ca50 0%, #d4af37 50%, #735c00 100%);
  border: 1px solid #ffe088;
  box-shadow: 0 0 10px rgba(242,202,80,0.2);
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0e0e0d; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #52482b; }

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
.shake-alert { animation: shake 0.55s ease; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.96); }
</style>
