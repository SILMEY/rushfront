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
const me   = computed(() => props.state.players.find(p => p.userId === auth.user?.id) ?? null);

function adjHasType(type: TileType): boolean {
  const { x: col, y: row } = props.tile;
  const { width, height, tiles } = props.state;
  const even = row % 2 === 0;
  const offsets: [number, number][] = even
    ? [[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]]
    : [[1,-1],[1,0],[1,1],[0,1],[-1,0],[0,-1]];
  for (const [dc, dr] of offsets) {
    const nc = col + dc, nr = row + dr;
    if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
    if ((tiles.types[nr * width + nc] as TileType) === type) return true;
  }
  return false;
}

const hasWonder = computed(() =>
  props.state.wonders?.some(w => w.playerId === me.value?.id) ?? false
);

type Entry = { building: BuildingType; label: string; icon: string; wood: number; stone: number };

const ALL: Entry[] = [
  { building: BuildingType.Sawmill,    label: "Scierie",    icon: "handsaw",         wood: 5,   stone: 0   },
  { building: BuildingType.Mine,       label: "Mine",       icon: "construction",    wood: 10,  stone: 0   },
  { building: BuildingType.FishingHut, label: "Port",       icon: "sailing",         wood: 10,  stone: 10  },
  { building: BuildingType.Barracks,   label: "Caserne",    icon: "shield",          wood: 20,  stone: 10  },
  { building: BuildingType.University, label: "Université", icon: "history_edu",     wood: 20,  stone: 20  },
  { building: BuildingType.City,       label: "Cité",       icon: "account_balance", wood: 40,  stone: 80  },
  { building: BuildingType.Wonder,     label: "Merveille",  icon: "temple_hindu",    wood: 150, stone: 300 },
];

const items = computed(() => {
  if (!me.value) return [];
  return ALL.filter(e => {
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

// Rayon réduit et marges pour rester dans le viewport
const RADIUS   = 58;
const HALF_BTN = 24;
const MARGIN   = RADIUS + HALF_BTN + 6;

const cx = computed(() => Math.min(Math.max(props.clientX, MARGIN), window.innerWidth  - MARGIN));
const cy = computed(() => Math.min(Math.max(props.clientY, MARGIN), window.innerHeight - MARGIN));

function itemStyle(i: number, total: number) {
  const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
  const x = Math.round(Math.cos(angle) * RADIUS);
  const y = Math.round(Math.sin(angle) * RADIUS);
  return { transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))` };
}
</script>

<template>
  <!-- Couche 1 : backdrop — ferme au clic GAUCHE seulement -->
  <div
    class="fixed inset-0 z-[400]"
    @click="emit('close')"
    @contextmenu.prevent
  />

  <!-- Couche 2 : items au-dessus du backdrop -->
  <div
    class="fixed z-[401]"
    :style="{ left: cx + 'px', top: cy + 'px' }"
  >
    <!-- Lignes de connexion SVG -->
    <svg
      class="absolute overflow-visible pointer-events-none"
      style="transform: translate(-50%, -50%)"
      width="1" height="1"
    >
      <line
        v-for="(item, i) in items"
        :key="'l' + item.building"
        x1="0" y1="0"
        :x2="Math.round(Math.cos((i / items.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
        :y2="Math.round(Math.sin((i / items.length) * 2 * Math.PI - Math.PI / 2) * RADIUS)"
        stroke="rgba(242,202,80,0.18)"
        stroke-width="1"
      />
    </svg>

    <!-- Point central -->
    <div
      class="absolute w-2.5 h-2.5 rounded-full bg-[#f2ca50]/50 border border-[#f2ca50]/70 pointer-events-none"
      style="transform: translate(-50%, -50%)"
    />

    <!-- Items -->
    <div
      v-for="(entry, i) in items"
      :key="entry.building"
      class="absolute"
      :style="itemStyle(i, items.length)"
    >
      <button
        class="flex flex-col items-center gap-0.5 group"
        :disabled="!canAfford(entry)"
        @click.stop="emit('build', entry.building)"
      >
        <div
          class="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-150 shadow-lg"
          :class="canAfford(entry)
            ? 'bg-[#1c1812]/95 border-[#8b7e66] group-hover:border-[#f2ca50] group-hover:scale-110'
            : 'bg-[#1c1812]/70 border-[#8b7e66]/25 opacity-40'"
        >
          <span
            :class="[
              (entry.icon.codePointAt(0) ?? 0) > 127 ? 'text-[22px]' : 'material-symbols-outlined text-[19px]',
              canAfford(entry) ? 'text-[#d4c59f]' : 'text-white/30'
            ]"
          >{{ entry.icon }}</span>
        </div>
        <span
          class="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap"
          :class="canAfford(entry) ? 'text-white/60' : 'text-white/20'"
        >{{ entry.label }}</span>
      </button>
    </div>
  </div>
</template>
