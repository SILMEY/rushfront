<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { GameStateSnapshot } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";
import { tileIndex } from "../../utils/tileUtils";
import ChatPanel from "./ChatPanel.vue";
import SectionTitle from "./SectionTitle.vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{ state: GameStateSnapshot | null }>();
const emit = defineEmits<{ (e: "close"): void }>();
const auth = useAuthStore();
const { t } = useI18n();

const me = computed(() => props.state?.players.find((p) => p.userId === auth.user?.id) ?? null);
const myName = computed(() => me.value?.name ?? auth.user?.name ?? "?");
const myColor = computed(() => me.value?.color ?? "#ffffff");

// ── Pouvoir spécial ───────────────────────────────────────────────────────────
const CIV_ICONS: Record<string, string> = {
  iron_dwarves:    "🗿",
  sylvan_elves:    "🌿",
  steppe_horde:    "🏇",
  aurelian_empire: "⚙️",
};
const civKey         = computed(() => me.value?.civilization ?? "");
const civIcon        = computed(() => CIV_ICONS[civKey.value] ?? "⚔️");
const civPowerName   = computed(() => civKey.value ? t(`civ_power.${civKey.value}.power`  as any) : "");
const civPowerHow    = computed(() => civKey.value ? t(`civ_power.${civKey.value}.how`    as any) : "");
const civPowerEffect = computed(() => civKey.value ? t(`civ_power.${civKey.value}.effect` as any) : "");

// ── Classement ────────────────────────────────────────────────────────────────

function tileCount(playerId: string): number {
  const state = props.state;
  if (!state) return 0;
  let n = 0;
  for (const o of state.tiles.owners) if (o === playerId) n++;
  return n;
}

const rankedPlayers = computed(() => {
  const state = props.state;
  if (!state) return [];
  return [...state.players]
    .map(p => ({ ...p, _tiles: tileCount(p.id) }))
    .sort((a, b) => {
      // Cases en priorité, population en secondaire
      if (b._tiles !== a._tiles) return b._tiles - a._tiles;
      const pa = a.resources.villagers + a.resources.soldiers;
      const pb = b.resources.villagers + b.resources.soldiers;
      return pb - pa;
    });
});

// ── Merveille ─────────────────────────────────────────────────────────────────

const nowMs = ref(Date.now());
let interval: number | null = null;
onMounted(() => { interval = window.setInterval(() => { nowMs.value = Date.now(); }, 500); });
onUnmounted(() => { if (interval !== null) window.clearInterval(interval); });

type ActiveWonder = { player: typeof rankedPlayers.value[0]; secondsLeft: number };

const activeWonders = computed((): ActiveWonder[] => {
  const s = props.state;
  if (!s || !s.wonders?.length) return [];
  return s.wonders
    .map(w => ({
      player: s.players.find(p => p.id === w.playerId)!,
      secondsLeft: Math.max(0, Math.ceil((w.endsAt - nowMs.value) / 1000))
    }))
    .filter(w => w.player);
});

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
</script>

<template>
  <aside class="stone-texture fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-72 flex-col border-r-4 border-outline-variant" role="complementary" :aria-label="t('left_panel.title')">

    <!-- Bouton fermeture mobile -->
    <button
      class="md:hidden absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white transition"
      :aria-label="t('left_panel.close_btn')"
      @click="emit('close')"
    >
      <span class="material-symbols-outlined text-[18px]">close</span>
    </button>

    <!-- En-tête "Informations" -->
    <div class="border-b-2 border-outline-variant bg-black/20 px-5 py-4 flex items-center justify-between shrink-0">
      <div>
        <h2 class="text-lg font-bold uppercase text-[#d4af37] leading-tight carved-text">{{ t('left_panel.title') }}</h2>
        <p class="text-[9px] font-bold uppercase tracking-widest text-white/30 italic mt-0.5">{{ t('left_panel.subtitle') }}</p>
      </div>
      <span class="material-symbols-outlined text-[#d4af37]/60" aria-hidden="true">leaderboard</span>
    </div>

    <!-- Merveilles actives (une par joueur) -->
    <div v-if="activeWonders.length" class="border-b-2 border-outline-variant shrink-0">
      <div
        v-for="w in activeWonders"
        :key="w.player.id"
        class="px-4 py-2.5 flex items-center gap-3 wonder-banner border-b border-white/5 last:border-b-0"
      >
        <div class="h-3 w-3 shrink-0 rounded-full border border-black/30" :style="{ backgroundColor: w.player.color }"></div>
        <span class="material-symbols-outlined text-[15px] shrink-0" style="font-variation-settings:'FILL' 1">temple_hindu</span>
        <div class="min-w-0 flex-1">
          <div class="text-[9px] font-bold uppercase tracking-widest text-white/40">{{ t('left_panel.wonder_label') }}</div>
          <div class="text-[11px] font-bold truncate" :style="{ color: w.player.color }">
            {{ w.player.name }} — {{ fmt(w.secondsLeft) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Classement -->
    <div class="border-b-2 border-outline-variant px-5 pt-4 pb-3 shrink-0">
      <SectionTitle>{{ t('left_panel.ranking_title') }}</SectionTitle>
      <div class="space-y-1">
        <div
          v-for="(p, i) in rankedPlayers"
          :key="p.id"
          class="flex items-center gap-2 rounded px-2 py-1"
          :class="p.id === me?.id ? 'bg-white/5' : ''"
        >
          <span class="text-[10px] text-white/25 w-4 shrink-0 font-mono">{{ i + 1 }}</span>
          <div class="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30" :style="{ backgroundColor: p.color }"></div>
          <span
            class="flex-1 truncate text-[11px] font-bold"
            :class="p.eliminated ? 'line-through opacity-30' : ''"
            :style="{ color: p.color }"
          >{{ p.name }}</span>
          <span class="text-[10px] shrink-0 font-mono flex items-center gap-1.5">
            <span class="text-[#d4af37]/60" title="Cases possédées">{{ p._tiles }}🗺</span>
            <span class="text-white/20">|</span>
            <span class="text-[#a8c090]/80">{{ p.resources.villagers }}</span>
            <span class="text-white/20">+</span>
            <span class="text-[#ef4444]/70">{{ p.resources.soldiers }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Pouvoir spécial -->
    <div v-if="civKey" class="border-b-2 border-outline-variant px-5 pt-4 pb-3 shrink-0">
      <SectionTitle>{{ t('civ_power.title') }}</SectionTitle>
      <div class="rounded border border-[#4d4635]/60 bg-[#1a1508]/60 px-3 py-2.5 space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="text-base leading-none">{{ civIcon }}</span>
          <span class="text-[11px] font-bold text-[#f2ca50] uppercase tracking-wide">{{ civPowerName }}</span>
        </div>
        <div class="text-[9px] font-bold uppercase tracking-widest text-white/25">{{ t('civ_power.how_label') }}</div>
        <div class="text-[10px] font-semibold text-[#d4c59f] leading-snug">{{ civPowerHow }}</div>
        <div class="text-[9px] leading-relaxed text-white/40">{{ civPowerEffect }}</div>
      </div>
    </div>

    <!-- Chat -->
    <div class="flex-1 min-h-0 flex flex-col">
      <div class="px-5 pt-4 pb-2 shrink-0">
        <SectionTitle>{{ t('left_panel.chat_title') }}</SectionTitle>
      </div>
      <ChatPanel
        v-if="state && me"
        :game-id="state.gameId"
        event-name="game:chat"
        :my-name="myName"
        :my-color="myColor"
      />
    </div>

  </aside>
</template>

<style scoped>
.stone-texture {
  background-color: #353533;
  background-image: url("https://www.transparenttextures.com/patterns/asfalt-dark.png");
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.4);
}
.border-outline-variant { border-color: #4d4635; }

.carved-text {
  text-shadow: -1px -1px 1px rgba(0, 0, 0, 0.8), 1px 1px 1px rgba(255, 255, 255, 0.1);
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
  margin-bottom: 10px;
}
.diamond {
  display: inline-block;
  width: 7px;
  height: 7px;
  background-color: #d4af37;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.wonder-banner {
  background: linear-gradient(90deg, rgba(232,121,249,0.08) 0%, transparent 100%);
  animation: pulse-wonder 2s ease-in-out infinite alternate;
}
@keyframes pulse-wonder {
  from { opacity: 1; }
  to { opacity: 0.7; }
}
</style>
