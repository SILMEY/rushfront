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
  // Palette inspired by `public/codejeu.html` (tile-water/forest/stone/void).
  [TileType.Plain]: "#131312",
  [TileType.Water]: "rgba(30, 58, 138, 0.40)",
  [TileType.Forest]: "rgba(20, 83, 45, 0.22)",
  [TileType.Quarry]: "rgba(68, 64, 60, 0.35)"
};

const GRID_DARK = "rgba(0,0,0,0.35)";
const GRID_LIGHT = "rgba(255,255,255,0.06)";
const OUTLINE = "rgba(77, 70, 53, 0.85)";

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

        const base = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;

        const sx = x * tileSize;

        ctx.fillStyle = base;
        ctx.fillRect(sx, sy, tileSize, tileSize);

        // Etched border style (like codejeu.html tiles)
        if (tsScreen >= 10) {
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = OUTLINE;
          ctx.strokeRect(sx, sy, tileSize, tileSize);
          // subtle etched highlights
          ctx.strokeStyle = GRID_DARK;
          ctx.beginPath();
          ctx.moveTo(sx + 0.5 / scale, sy + tileSize - 0.5 / scale);
          ctx.lineTo(sx + 0.5 / scale, sy + 0.5 / scale);
          ctx.lineTo(sx + tileSize - 0.5 / scale, sy + 0.5 / scale);
          ctx.stroke();
          ctx.strokeStyle = GRID_LIGHT;
          ctx.beginPath();
          ctx.moveTo(sx + tileSize - 0.5 / scale, sy + 0.5 / scale);
          ctx.lineTo(sx + tileSize - 0.5 / scale, sy + tileSize - 0.5 / scale);
          ctx.lineTo(sx + 0.5 / scale, sy + tileSize - 0.5 / scale);
          ctx.stroke();
        }

        if (ownerColor) {
          ctx.fillStyle = ownerColor;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(sx, sy, tileSize, tileSize);
          ctx.globalAlpha = 1;
        }

        // Terrain icons (Material Symbols ligatures) like `codejeu.html`
        if (tsScreen >= 28) {
          const icon =
            type === TileType.Water ? "water" : type === TileType.Forest ? "park" : type === TileType.Quarry ? "filter_hdr" : "";
          if (icon) {
            ctx.fillStyle =
              type === TileType.Water
                ? "rgba(96,165,250,0.35)"
                : type === TileType.Forest
                  ? "rgba(34,197,94,0.30)"
                  : "rgba(168,162,158,0.35)";
            ctx.font = `${Math.max(18 / scale, tileSize * 0.52)}px "Material Symbols Outlined"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(icon, sx + tileSize / 2, sy + tileSize / 2);
          }
        }

        // Buildings: bâtiments importants toujours visibles, mineurs seulement si assez zoomé
        if (building != null) {
          const important = building === BuildingType.Base
            || building === BuildingType.Barracks
            || building === BuildingType.University;

          if (important || tsScreen >= 28) {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            if (building === BuildingType.Base) {
              ctx.fillStyle = ownerColor ? rgba(ownerColor, 0.95) : rgba("#f2ca50", 0.9);
              // Taille minimum 10px écran pour rester lisible même très dézoomé
              ctx.font = `${Math.min(tileSize, Math.max(10 / scale, tileSize * 0.6))}px "Material Symbols Outlined"`;
              ctx.fillText("castle", sx + tileSize / 2, sy + tileSize / 2);
            } else if (building === BuildingType.Barracks || building === BuildingType.University || building === BuildingType.City) {
              ctx.fillStyle = building === BuildingType.City ? rgba("#60a5fa", 0.95) : rgba("#f2ca50", 0.95);
              ctx.font = `${Math.min(tileSize, Math.max(10 / scale, tileSize * 0.55))}px "Material Symbols Outlined"`;
              const icon = building === BuildingType.Barracks ? "shield" : building === BuildingType.University ? "history_edu" : "location_city";
              ctx.fillText(icon, sx + tileSize / 2, sy + tileSize / 2);
            } else if (building === BuildingType.Bridge) {
              ctx.fillStyle = rgba("#d97706", 0.9);
              ctx.font = `${Math.min(tileSize, Math.max(10 / scale, tileSize * 0.5))}px "Material Symbols Outlined"`;
              ctx.fillText("water", sx + tileSize / 2, sy + tileSize / 2);
            } else if (building === BuildingType.Wonder) {
              // Dessiné dans le second pass (overlay 4×4)
            } else {
              // Bâtiments mineurs : seulement si tsScreen >= 28
              const icon =
                building === BuildingType.FishingHut ? "sailing"
                : building === BuildingType.Sawmill   ? "forest"
                :                                       "construction";
              ctx.fillStyle = rgba("#f2ca50", 0.75);
              ctx.font = `${Math.max(16 / scale, tileSize * 0.55)}px "Material Symbols Outlined"`;
              ctx.fillText(icon, sx + tileSize / 2, sy + tileSize / 2);
            }
          }
        }
      }
    }

    // Second pass : merveilles (overlay 4×4 centré sur la case)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * state.width + x;
        if ((state.tiles.buildings[i] as BuildingType) !== BuildingType.Wonder) continue;
        const owner = state.tiles.owners[i];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#f2ca50") : "#f2ca50";

        const cx = (x + 0.5) * tileSize;
        const cy = (y + 0.5) * tileSize;
        const half = tileSize * 2; // 4×4 tiles total

        // Clamp aux bornes de la map
        const left   = Math.max(0,                   cx - half);
        const top    = Math.max(0,                   cy - half);
        const right  = Math.min(state.width  * tileSize, cx + half);
        const bottom = Math.min(state.height * tileSize, cy + half);

        // Halo coloré
        ctx.fillStyle = rgba(ownerColor, 0.18);
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.strokeStyle = rgba(ownerColor, 0.7);
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.setLineDash([]);

        // Icône centrale
        ctx.fillStyle = rgba(ownerColor, 0.95);
        ctx.font = `${Math.min(tileSize * 3, Math.max(12 / scale, tileSize * 1.5))}px "Material Symbols Outlined"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("temple_hindu", cx, cy);
      }
    }

    if (tsScreen >= 18) {
      ctx.strokeStyle = "rgba(153, 144, 124, 0.15)";
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

    const now = Date.now();
    for (const b of state.brouillage ?? []) {
      if (b.expiresAt <= now) continue;
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

    // Avertissement radar : cases capturées par l'ennemi (overlay clignotant rouge)
    for (const w of game.attackWarnings) {
      if (w.expiresAt <= now) continue;
      if (w.x < x0 || w.x > x1 || w.y < y0 || w.y > y1) continue;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(now / 160));
      const sx = w.x * tileSize;
      const sy = w.y * tileSize;
      ctx.fillStyle = rgba("#ef4444", 0.30 * pulse);
      ctx.fillRect(sx, sy, tileSize, tileSize);
      ctx.strokeStyle = rgba("#ef4444", pulse);
      ctx.lineWidth = 3 / scale;
      ctx.strokeRect(sx + 1.5 / scale, sy + 1.5 / scale, tileSize - 3 / scale, tileSize - 3 / scale);
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
