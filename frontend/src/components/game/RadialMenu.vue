<script setup lang="ts">
import { computed } from "vue";
import { BuildingType, TileType } from "../../types/game";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useAuthStore } from "../../stores/authStore";

const props = defineProps<{
  state: GameStateSnapshot;
  tile: Vec2;
  clientX: number;
  clientY: number;
}>();

const emit = defineEmits<{
  (e: "build", b: BuildingType): void;
  (e: "close"): void;
}>();

const auth = useAuthStore();
const me = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);

function adjHasType(type: TileType): boolean {
  const { x, y } = props.tile;
  const { width, height } = props.state;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if ((props.state.tiles.types[ny * width + nx] as TileType) === type) return true;
  }
  return false;
}

const hasWonder = computed(() =>
  props.state.wonders?.some(w => w.playerId === me.value?.id) ?? false
);

type Entry = { building: BuildingType; label: string; icon: string; wood: number; stone: number };

const ENTRIES: Entry[] = [
  { building: BuildingType.Sawmill,    label: "Scierie",    icon: "forest",        wood: 5,   stone: 0   },
  { building: BuildingType.Mine,       label: "Mine",       icon: "construction",  wood: 10,  stone: 0   },
  { building: BuildingType.FishingHut, label: "Port",       icon: "sailing",       wood: 10,  stone: 10  },
  { building: BuildingType.Barracks,   label: "Caserne",    icon: "shield",        wood: 20,  stone: 10  },
  { building: BuildingType.University, label: "Université", icon: "history_edu",   wood: 20,  stone: 20  },
  { building: BuildingType.City,       label: "Cité",       icon: "location_city", wood: 40,  stone: 80  },
  { building: BuildingType.Wonder,     label: "Merveille",  icon: "temple_hindu",  wood: 150, stone: 300 },
];

const items = computed(() => {
  if (!me.value) return [];
  return ENTRIES.filter(e => {
    if (e.building === BuildingType.Sawmill    && !adjHasType(TileType.Forest)) return false;
    if (e.building === BuildingType.Mine       && !adjHasType(TileType.Quarry)) return false;
    if (e.building === BuildingType.FishingHut && !adjHasType(TileType.Water))  return false;
    if (e.building === BuildingType.Wonder     && hasWonder.value)              return false;
    return true;
  });
});

function canAfford(e: Entry): boolean {
  if (!me.value) return false;
  return me.value.resources.wood >= e.wood && me.value.resources.stone >= e.stone;
}

// Rayon du cercle et marges
const RADIUS = 76;
const HALF_BTN = 26;
const MARGIN = RADIUS + HALF_BTN + 8;

const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));

function pos(i: number, total: number) {
  // Commence en haut (−90°) et tourne dans le sens horaire
  const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
  const x = Math.round(Math.cos(angle) * RADIUS);
  const y = Math.round(Math.sin(angle) * RADIUS);
  return { transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))` };
}

function pick(entry: Entry) {
  if (!canAfford(entry)) return;
  emit("build", entry.building);
}
</script>

<template>
  <!-- Backdrop invisible -->
  <div
    class="fixed inset-0 z-[400]"
    @click.self="emit('close')"
    @contextmenu.prevent="emit('close')"
    @keydown.esc="emit('close')"
  >
    <!-- Pivot du cercle -->
    <div
      class="absolute pointer-events-none select-none"
      :style="{ left: cx + 'px', top: cy + 'px' }"
    >
      <!-- Lignes de connexion (trait vers chaque item) -->
      <svg
        class="absolute overflow-visible"
        style="transform: translate(-50%, -50%)"
        width="1" height="1"
      >
        <line
          v-for="(item, i) in items"
          :key="'l' + item.building"
          x1="0" y1="0"
          :x2="Math.round(Math.cos((i / items.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
          :y2="Math.round(Math.sin((i / items.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
          stroke="rgba(242,202,80,0.15)"
          stroke-width="1"
        />
      </svg>

      <!-- Point central -->
      <div
        class="absolute w-3 h-3 rounded-full bg-[#f2ca50]/40 border border-[#f2ca50]/60 shadow-[0_0_8px_rgba(242,202,80,0.4)]"
        style="transform: translate(-50%, -50%)"
      ></div>

      <!-- Items -->
      <div
        v-for="(entry, i) in items"
        :key="entry.building"
        class="absolute pointer-events-auto"
        :style="pos(i, items.length)"
      >
        <div class="flex flex-col items-center gap-0.5">
          <button
            class="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-150 shadow-lg"
            :class="canAfford(entry)
              ? 'bg-[#1c1812]/95 border-[#8b7e66] hover:border-[#f2ca50] hover:scale-110 cursor-pointer'
              : 'bg-[#1c1812]/80 border-[#8b7e66]/25 opacity-40 cursor-not-allowed'"
            :title="entry.label"
            @click.stop="pick(entry)"
          >
            <span class="material-symbols-outlined text-[19px]"
                  :class="canAfford(entry) ? 'text-[#d4c59f]' : 'text-white/40'"
            >{{ entry.icon }}</span>
          </button>
          <span class="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap"
                :class="canAfford(entry) ? 'text-white/50' : 'text-white/20'"
          >{{ entry.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
