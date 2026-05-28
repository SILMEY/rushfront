<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useGameStore } from "../../stores/gameStore";
import { useLobbyStore } from "../../stores/lobbyStore";

const game = useGameStore();
const lobby = useLobbyStore();

type Toast = { id: number; message: string };
const toasts = ref<Toast[]>([]);
let nextId = 1;

function push(message: string) {
  const id = nextId++;
  toasts.value.push({ id, message });
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 2500);
}

const lastError = computed(() => game.lastError ?? lobby.lastError ?? null);
watch(lastError, (msg) => {
  if (!msg) return;
  // Avoid spamming toasts while painting claims (lots of expected rejections).
  const suppressedDuringPaint = new Set([
    "not_adjacent",
    "already_owned",
    "water",
    "tile_blocked",
    "out_of_bounds",
    "occupied",
    "must_own_tile",
    "tile_has_building",
    "invalid_tile"
  ]);

  if (game.isPainting && suppressedDuringPaint.has(msg)) {
    if (game.lastError) game.lastError = null;
    return;
  }

  // De-dupe repeated messages for a short window.
  const last = toasts.value[toasts.value.length - 1];
  if (!last || last.message !== msg) push(msg);

  if (game.lastError) game.lastError = null;
  if (lobby.lastError) lobby.lastError = null;
});
</script>

<template>
  <div class="pointer-events-none fixed left-1/2 top-4 z-50 w-full -translate-x-1/2 px-4">
    <div class="mx-auto grid max-w-xl gap-2">
      <transition-group
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-2 text-sm text-slate-100 ring-1 ring-black/30 backdrop-blur"
        >
          {{ t.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>
