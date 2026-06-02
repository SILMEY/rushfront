<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useCamera } from "../../composables/useCamera";
import { useGameRenderer } from "../../composables/useGameRenderer";
import { useGameStore } from "../../stores/gameStore";

const props = defineProps<{
  state: GameStateSnapshot | null;
}>();

const emit = defineEmits<{
  (e: "tile-click", pos: Vec2): void;
  (e: "tile-hover", pos: Vec2 | null): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const tileSize = 64;

const { camera, screenToWorld, pan, zoomAt } = useCamera();
const { render } = useGameRenderer();
const game = useGameStore();

const hovered = ref<Vec2 | null>(null);

const hasState = computed(() => !!props.state);

let raf: number | null = null;
function scheduleDraw() {
  if (raf != null) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    draw();
  });
}

function draw() {
  const canvas = canvasRef.value;
  const state = props.state;
  if (!canvas || !state) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render({
    ctx,
    state,
    widthPx: rect.width,
    heightPx: rect.height,
    tileSize,
    camera,
    hovered: hovered.value
  });
}

watch(
  () => props.state,
  () => scheduleDraw(),
  { deep: true }
);
watch(
  () => [camera.x, camera.y, camera.zoom],
  () => scheduleDraw()
);
watch(
  () => Object.keys(game.optimisticClaims).length,
  () => scheduleDraw()
);

let dragging = false;
let selecting = false;
let dragStart: { x: number; y: number } | null = null;
let dragMoved = 0;
let lastSelectedKey: string | null = null;

function toTile(clientX: number, clientY: number): Vec2 | null {
  const canvas = canvasRef.value;
  const state = props.state;
  if (!canvas || !state) return null;
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const world = screenToWorld(localX, localY);
  const tx = Math.floor(world.x / tileSize);
  const ty = Math.floor(world.y / tileSize);
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return null;
  return { x: tx, y: ty };
}

function onPointerDown(e: PointerEvent) {
  if (!hasState.value) return;
  // Left click: pan (drag) / select (click).
  // Right click: select tiles only (no pan).
  if (e.button !== 0 && e.button !== 2) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  dragging = e.button === 0;
  selecting = e.button === 2;
  dragStart = { x: e.clientX, y: e.clientY };
  dragMoved = 0;

  if (selecting) {
    const tile = toTile(e.clientX, e.clientY);
    if (tile) {
      const key = `${tile.x},${tile.y}`;
      lastSelectedKey = key;
      emit("tile-click", tile);
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (!hasState.value) return;
  const tile = toTile(e.clientX, e.clientY);
  const prev = hovered.value;
  hovered.value = tile;
  emit("tile-hover", tile);

  // Redraw immediately when hovered tile changes (purely client-side, no server round-trip)
  if (tile?.x !== prev?.x || tile?.y !== prev?.y) scheduleDraw();

  if (!dragStart) return;

  if (dragging) {
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    dragStart = { x: e.clientX, y: e.clientY };
    pan(dx, dy);
    return;
  }

  if (selecting && tile) {
    const key = `${tile.x},${tile.y}`;
    if (key !== lastSelectedKey) {
      lastSelectedKey = key;
      emit("tile-click", tile);
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (!hasState.value) return;
  const wasDragging = dragging;
  dragging = false;
  selecting = false;
  lastSelectedKey = null;
  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  if (wasDragging && dragMoved < 6) {
    const tile = toTile(e.clientX, e.clientY);
    if (tile) emit("tile-click", tile);
  }
}

function onWheel(e: WheelEvent) {
  if (!hasState.value) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.9;
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
}

onMounted(() => scheduleDraw());
onBeforeUnmount(() => {
  if (raf != null) cancelAnimationFrame(raf);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="block h-full w-full touch-none rounded-xl"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @contextmenu.prevent
    @wheel="onWheel"
  />
</template>
