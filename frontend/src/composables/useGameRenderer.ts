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
    const tsScreen = tileSize * scale;

    const worldLeft = (-camera.x) / scale;
    const worldTop = (-camera.y) / scale;
    const worldRight = worldLeft + widthPx / scale;
    const worldBottom = worldTop + heightPx / scale;

    const x0 = Math.max(0, Math.floor(worldLeft / tileSize) - 1);
    const y0 = Math.max(0, Math.floor(worldTop / tileSize) - 1);
    const x1 = Math.min(state.width - 1, Math.ceil(worldRight / tileSize) + 1);
    const y1 = Math.min(state.height - 1, Math.ceil(worldBottom / tileSize) + 1);

    const colorByPlayer = new Map(state.players.map((p) => [p.id, p.color] as const));

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    for (let y = y0; y <= y1; y++) {
      const sy = y * tileSize;
      for (let x = x0; x <= x1; x++) {
        const i = y * state.width + x;
        const type = state.tiles.types[i] as TileType;
        const owner = state.tiles.owners[i];
        const building = state.tiles.buildings[i] as BuildingType | null;
        const contestedUntil = state.tiles.contestedUntil[i];

        const base = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;

        const sx = x * tileSize;

        ctx.fillStyle = base;
        ctx.fillRect(sx, sy, tileSize, tileSize);

        if (ownerColor) {
          ctx.fillStyle = ownerColor;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(sx, sy, tileSize, tileSize);
          ctx.globalAlpha = 1;
        }

        if (contestedUntil != null && contestedUntil >= state.currentTurn) {
          ctx.fillStyle = rgba("#eab308", 0.18);
          ctx.fillRect(sx, sy, tileSize, tileSize);
          ctx.strokeStyle = rgba("#eab308", 0.35);
          ctx.lineWidth = 1 / scale;
          ctx.beginPath();
          ctx.moveTo(sx, sy + tileSize);
          ctx.lineTo(sx + tileSize, sy);
          ctx.stroke();
        }

        if (building != null) {
          if (tsScreen < 18) continue;
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
          ctx.font = `${Math.max(10 / scale, tileSize * 0.55)}px ui-sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(letter, sx + tileSize / 2, sy + tileSize / 2 + 0.5 / scale);
        }
      }
    }

    if (tsScreen >= 14) {
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();

      const sx0 = x0 * tileSize;
      const sy0 = y0 * tileSize;
      const sx1 = (x1 + 1) * tileSize;
      const sy1 = (y1 + 1) * tileSize;

      for (let x = x0; x <= x1 + 1; x++) {
        const sx = x * tileSize + 0.5 / scale;
        ctx.moveTo(sx, sy0);
        ctx.lineTo(sx, sy1);
      }
      for (let y = y0; y <= y1 + 1; y++) {
        const sy = y * tileSize + 0.5 / scale;
        ctx.moveTo(sx0, sy);
        ctx.lineTo(sx1, sy);
      }

      ctx.stroke();
    }

    for (const [pid, intents] of Object.entries(state.claims)) {
      const color = colorByPlayer.get(pid);
      if (!color) continue;
      ctx.fillStyle = lighten(color, 0.45);
      ctx.globalAlpha = 0.7;
      for (const c of intents) {
        ctx.fillRect(c.x * tileSize, c.y * tileSize, tileSize, tileSize);
      }
      ctx.globalAlpha = 1;
    }

    const myPlayerId = game.mePlayer?.id ?? null;
    const myColor = myPlayerId ? colorByPlayer.get(myPlayerId) ?? null : null;

    for (const key of Object.keys(game.optimisticClaims)) {
      const [xStr, yStr] = key.split(",");
      const x = Number(xStr);
      const y = Number(yStr);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const sx = x * tileSize;
      const sy = y * tileSize;
      ctx.fillStyle = myColor ? lighten(myColor, 0.45) : rgba("#ffffff", 0.08);
      ctx.fillRect(sx, sy, tileSize, tileSize);
      ctx.strokeStyle = myColor ? rgba(myColor, 0.35) : rgba("#ffffff", 0.12);
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(sx + 0.5 / scale, sy + 0.5 / scale, tileSize - 1 / scale, tileSize - 1 / scale);
    }

    for (const builds of Object.values(state.pendingBuilds ?? {})) {
      if (tsScreen < 18) break;
      for (const b of builds) {
        const sx = b.x * tileSize;
        const sy = b.y * tileSize;
        ctx.fillStyle = rgba("#000000", 0.25);
        ctx.fillRect(sx, sy, tileSize, tileSize);

        ctx.fillStyle = rgba("#ffffff", 0.9);
        ctx.font = `${Math.max(10 / scale, tileSize * 0.45)}px ui-sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏗", sx + tileSize / 2, sy + tileSize / 2);
      }
    }

    for (const b of state.brouillage ?? []) {
      if (b.untilTurn < state.currentTurn) continue;
      const sx = b.x * tileSize;
      const sy = b.y * tileSize;
      ctx.fillStyle = rgba("#ef4444", 0.12);
      ctx.fillRect(sx, sy, tileSize, tileSize);
      ctx.strokeStyle = rgba("#ef4444", 0.35);
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + tileSize, sy + tileSize);
      ctx.stroke();
    }

    if (params.hovered) {
      const sx = params.hovered.x * tileSize;
      const sy = params.hovered.y * tileSize;
      ctx.strokeStyle = rgba("#60a5fa", 0.9);
      ctx.lineWidth = 2 / scale;
      ctx.strokeRect(sx + 1 / scale, sy + 1 / scale, tileSize - 2 / scale, tileSize - 2 / scale);
    }

    ctx.restore();
  }

  return { render };
}
