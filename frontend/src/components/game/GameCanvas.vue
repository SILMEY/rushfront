<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { GameStateSnapshot, Vec2 } from "../../types/game";
import { useCamera } from "../../composables/useCamera";
import { useGameRenderer } from "../../composables/useGameRenderer";
import { useGameStore } from "../../stores/gameStore";
import { worldToHex, hexCenter, hexMapBounds } from "../../utils/hexGrid";

const props = defineProps<{
  state: GameStateSnapshot | null;
}>();

const emit = defineEmits<{
  (e: "tile-click", pos: Vec2): void;
  (e: "tile-dblclick", pos: Vec2): void;
  (e: "tile-hover", pos: Vec2 | null): void;
  (e: "tile-context", pos: Vec2, clientX: number, clientY: number): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const tileSize = 64;

const { camera, screenToWorld, worldToScreen, pan, zoomAt } = useCamera();
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

  const target = game.expandTarget;
  if (target) {
    const { x: wx, y: wy } = hexCenter(target.x, target.y, tileSize);
    const { x: sx, y: sy } = worldToScreen(wx, wy);
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 250);
    const r = tileSize * camera.zoom * 0.45 * pulse;
    ctx.save();
    ctx.strokeStyle = `rgba(212,175,55,${0.9 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    const arm = r * 0.55;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sx - arm, sy); ctx.lineTo(sx + arm, sy);
    ctx.moveTo(sx, sy - arm); ctx.lineTo(sx, sy + arm);
    ctx.stroke();
    ctx.restore();
    scheduleDraw();
  }

  const atkTarget = game.attackTarget;
  if (atkTarget) {
    const { x: wx, y: wy } = hexCenter(atkTarget.x, atkTarget.y, tileSize);
    const { x: sx, y: sy } = worldToScreen(wx, wy);
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 180));
    const r = tileSize * camera.zoom * 0.42 * pulse;
    ctx.save();
    ctx.strokeStyle = `rgba(239,68,68,${0.9 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    const arm = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - arm, sy - arm); ctx.lineTo(sx + arm, sy + arm);
    ctx.moveTo(sx + arm, sy - arm); ctx.lineTo(sx - arm, sy + arm);
    ctx.stroke();
    ctx.restore();
    scheduleDraw();
  }

  if (game.attackWarnings.some(w => w.expiresAt > Date.now())) scheduleDraw();
}

watch(
  () => game.attackWarnings.length,
  (n) => { if (n > 0) scheduleDraw(); }
);

let cameraReady = false;
watch(
  () => props.state,
  (state) => {
    if (state && !cameraReady) {
      cameraReady = true;
      const canvas = canvasRef.value;
      const rect = canvas ? canvas.getBoundingClientRect() : { width: 1200, height: 800 };
      const { w: mapW, h: mapH } = hexMapBounds(state.width, state.height, tileSize);
      const fitZoom = Math.min(rect.width / mapW, rect.height / mapH) * 0.90;
      camera.zoom = Math.max(0.10, Math.min(0.40, fitZoom));
      camera.x = rect.width  / 2 - (mapW / 2) * camera.zoom;
      camera.y = rect.height / 2 - (mapH / 2) * camera.zoom;
    }
  }
);
watch(() => game.stateRevision, () => scheduleDraw());
watch(() => [camera.x, camera.y, camera.zoom], () => scheduleDraw());
watch(() => Object.keys(game.optimisticClaims).length, () => scheduleDraw());

// ── Pointer / touch state ──────────────────────────────────────────────────
let dragging = false;
let selecting = false;
let dragStart: { x: number; y: number } | null = null;
let dragMoved = 0;
let lastSelectedKey: string | null = null;
let lastClickTime = 0;
let lastClickTile: Vec2 | null = null;

// Pinch zoom
const activePointers = new Map<number, { x: number; y: number }>();
let lastPinchDist = 0;

function getPinchDist(): number {
  const pts = [...activePointers.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
}
function getPinchCenter(): { x: number; y: number } {
  const pts = [...activePointers.values()];
  if (pts.length < 2) return { x: 0, y: 0 };
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

// Long-press (context menu on touch)
let longPressTimer: number | null = null;

function clearLongPress() {
  if (longPressTimer !== null) { window.clearTimeout(longPressTimer); longPressTimer = null; }
}

function toTile(clientX: number, clientY: number): Vec2 | null {
  const canvas = canvasRef.value;
  const state = props.state;
  if (!canvas || !state) return null;
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const world = screenToWorld(localX, localY);
  return worldToHex(world.x, world.y, tileSize, state.width, state.height);
}

function onPointerDown(e: PointerEvent) {
  if (!hasState.value) return;
  if (e.button !== 0 && e.button !== 2) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (e.button === 2) {
    const tile = toTile(e.clientX, e.clientY);
    if (tile) emit("tile-context", tile, e.clientX, e.clientY);
    return;
  }

  if (activePointers.size >= 2) {
    // Entering pinch — cancel any in-progress drag or long-press
    dragging = false;
    dragStart = null;
    clearLongPress();
    lastPinchDist = getPinchDist();
    return;
  }

  dragging = true;
  selecting = false;
  dragStart = { x: e.clientX, y: e.clientY };
  dragMoved = 0;

  // Long-press to open context menu on touch devices
  if (e.pointerType === "touch") {
    const cx = e.clientX;
    const cy = e.clientY;
    longPressTimer = window.setTimeout(() => {
      longPressTimer = null;
      if (dragMoved < 8) {
        dragging = false;
        dragMoved = Infinity; // prevent click after long-press
        const tile = toTile(cx, cy);
        if (tile) emit("tile-context", tile, cx, cy);
      }
    }, 500);
  }
}

function onPointerMove(e: PointerEvent) {
  if (!hasState.value) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // Pinch zoom when 2 fingers active
  if (activePointers.size >= 2) {
    const dist = getPinchDist();
    if (lastPinchDist > 0 && dist > 0) {
      const factor = dist / lastPinchDist;
      const center = getPinchCenter();
      const canvas = canvasRef.value!;
      const rect = canvas.getBoundingClientRect();
      zoomAt(factor, center.x - rect.left, center.y - rect.top);
    }
    lastPinchDist = dist;
    return;
  }

  const tile = toTile(e.clientX, e.clientY);
  const prev = hovered.value;
  hovered.value = tile;
  emit("tile-hover", tile);
  if (tile?.x !== prev?.x || tile?.y !== prev?.y) scheduleDraw();

  if (!dragStart) return;

  if (dragging) {
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    dragStart = { x: e.clientX, y: e.clientY };
    if (dragMoved > 8) clearLongPress();
    pan(dx, dy);
  }
}

function onPointerUp(e: PointerEvent) {
  if (!hasState.value) return;

  clearLongPress();

  const wasPinching = activePointers.size >= 2;
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) lastPinchDist = 0;

  // After releasing a pinch finger, don't register a click
  if (wasPinching) {
    dragging = false;
    dragStart = null;
    dragMoved = Infinity;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    return;
  }

  const wasDragging = dragging;
  dragging = false;
  selecting = false;
  lastSelectedKey = null;
  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

  if (wasDragging && dragMoved < 6) {
    const tile = toTile(e.clientX, e.clientY);
    if (tile) {
      const now = Date.now();
      const isDouble = now - lastClickTime < 350
        && lastClickTile?.x === tile.x
        && lastClickTile?.y === tile.y;
      if (isDouble) {
        emit("tile-dblclick", tile);
        lastClickTime = 0;
        lastClickTile = null;
      } else {
        emit("tile-click", tile);
        lastClickTime = now;
        lastClickTile = tile;
      }
    }
  }
}

function onPointerCancel(e: PointerEvent) {
  clearLongPress();
  activePointers.delete(e.pointerId);
  lastPinchDist = 0;
  dragging = false;
  dragStart = null;
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
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
  clearLongPress();
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="block h-full w-full touch-none rounded-xl"
    role="application"
    aria-label="Carte du jeu — appui long pour ouvrir le menu"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @contextmenu.prevent
    @wheel="onWheel"
  />
</template>
