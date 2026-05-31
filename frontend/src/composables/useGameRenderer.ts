import type { GameStateSnapshot } from "../types/game";
import { BuildingType, TileType } from "../types/game";
import { lighten, rgba } from "../utils/colors";
import { useGameStore } from "../stores/gameStore";

type RenderParams = {
  ctx: CanvasRenderingContext2D;
  state: GameStateSnapshot;
  widthPx: number;
  heightPx: number;
  tileSize: number;
  camera: { x: number; y: number; zoom: number };
  hovered?: { x: number; y: number } | null;
};

const TILE_COLORS: Record<number, string> = {
  // Dark strategy palette: more neutral gray for plains, keep water readable.
  [TileType.Plain]: "#0b0f14",
  [TileType.Water]: "#0b3a66",
  [TileType.Forest]: "#0a2a18",
  [TileType.Quarry]: "#141a22"
};

const GRID = rgba("#94a3b8", 0.08);

export function useGameRenderer() {
  const game = useGameStore();

  function render(params: RenderParams) {
    const { ctx, state, widthPx, heightPx, tileSize, camera } = params;
    ctx.clearRect(0, 0, widthPx, heightPx);

    const scale = camera.zoom;
    const ts = tileSize * scale;

    const worldLeft = (-camera.x) / scale;
    const worldTop = (-camera.y) / scale;
    const worldRight = worldLeft + widthPx / scale;
    const worldBottom = worldTop + heightPx / scale;

    const x0 = Math.max(0, Math.floor(worldLeft / tileSize) - 1);
    const y0 = Math.max(0, Math.floor(worldTop / tileSize) - 1);
    const x1 = Math.min(state.width - 1, Math.ceil(worldRight / tileSize) + 1);
    const y1 = Math.min(state.height - 1, Math.ceil(worldBottom / tileSize) + 1);

    const colorByPlayer = new Map(state.players.map((p) => [p.id, p.color] as const));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * state.width + x;
        const type = state.tiles.types[i] as TileType;
        const owner = state.tiles.owners[i];
        const building = state.tiles.buildings[i] as BuildingType | null;
        const contestedUntil = state.tiles.contestedUntil[i];

        const base = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;

        const sx = x * tileSize * scale + camera.x;
        const sy = y * tileSize * scale + camera.y;

        ctx.fillStyle = base;
        ctx.fillRect(sx, sy, ts, ts);

        if (ownerColor) {
          ctx.fillStyle = ownerColor;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(sx, sy, ts, ts);
          ctx.globalAlpha = 1;
        }

        // Contest styling
        if (contestedUntil != null && contestedUntil >= state.currentTurn) {
          ctx.fillStyle = rgba("#eab308", 0.18);
          ctx.fillRect(sx, sy, ts, ts);
          ctx.strokeStyle = rgba("#eab308", 0.35);
          ctx.beginPath();
          ctx.moveTo(sx, sy + ts);
          ctx.lineTo(sx + ts, sy);
          ctx.stroke();
        }

        // Grid
        ctx.strokeStyle = GRID;
        ctx.strokeRect(sx + 0.5, sy + 0.5, ts, ts);

        if (building != null) {
          const letter =
            building === BuildingType.Base
              ? "B"
              : building === BuildingType.FishingHut
                ? "P"
                : building === BuildingType.Sawmill
                  ? "S"
                  : building === BuildingType.Mine
                    ? "M"
                    : building === BuildingType.Barracks
                      ? "C"
                      : "U";
          ctx.fillStyle = rgba("#ffffff", 0.9);
          ctx.font = `${Math.max(10, ts * 0.55)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(letter, sx + ts / 2, sy + ts / 2 + 0.5);
        }
      }
    }

    // Claims second pass (to avoid per-tile scanning)
    for (const [pid, intents] of Object.entries(state.claims)) {
      const color = colorByPlayer.get(pid);
      if (!color) continue;
      ctx.fillStyle = lighten(color, 0.45);
      ctx.globalAlpha = 0.7;
      for (const c of intents) {
        const sx = c.x * tileSize * scale + camera.x;
        const sy = c.y * tileSize * scale + camera.y;
        ctx.fillRect(sx, sy, ts, ts);
      }
      ctx.globalAlpha = 1;
    }

    // Optimistic claims (client-only) for immediate feedback.
    for (const key of game.optimisticClaims) {
      const [xStr, yStr] = key.split(",");
      const x = Number(xStr);
      const y = Number(yStr);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const sx = x * tileSize * scale + camera.x;
      const sy = y * tileSize * scale + camera.y;
      ctx.fillStyle = rgba("#ffffff", 0.08);
      ctx.fillRect(sx, sy, ts, ts);
      ctx.strokeStyle = rgba("#ffffff", 0.12);
      ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
    }

    // Pending builds: show a chantier icon so player understands it's queued/paid.
    for (const [pid, builds] of Object.entries(state.pendingBuilds ?? {})) {
      const color = colorByPlayer.get(pid);
      void color;
      for (const b of builds) {
        const sx = b.x * tileSize * scale + camera.x;
        const sy = b.y * tileSize * scale + camera.y;
        ctx.fillStyle = rgba("#000000", 0.25);
        ctx.fillRect(sx, sy, ts, ts);

        ctx.fillStyle = rgba("#ffffff", 0.9);
        ctx.font = `${Math.max(10, ts * 0.45)}px ui-sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏗", sx + ts / 2, sy + ts / 2);
      }
    }

    // Brouillage: dark red overlay on blocked tiles.
    for (const b of state.brouillage ?? []) {
      if (b.untilTurn < state.currentTurn) continue;
      const sx = b.x * tileSize * scale + camera.x;
      const sy = b.y * tileSize * scale + camera.y;
      ctx.fillStyle = rgba("#ef4444", 0.12);
      ctx.fillRect(sx, sy, ts, ts);
      ctx.strokeStyle = rgba("#ef4444", 0.35);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + ts, sy + ts);
      ctx.stroke();
    }

    if (params.hovered) {
      const sx = params.hovered.x * tileSize * scale + camera.x;
      const sy = params.hovered.y * tileSize * scale + camera.y;
      ctx.strokeStyle = rgba("#60a5fa", 0.9);
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
      ctx.lineWidth = 1;
    }
  }

  return { render };
}
