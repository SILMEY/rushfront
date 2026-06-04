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
  [TileType.Plain]: "#131312",
  [TileType.Water]: "rgba(30, 58, 138, 0.40)",
  [TileType.Forest]: "rgba(20, 83, 45, 0.22)",
  [TileType.Quarry]: "rgba(68, 64, 60, 0.35)"
};

const OUTLINE = "rgba(77, 70, 53, 0.85)";

// Octagon corner cut (fraction of tileSize)
const CUT = 0.21;
// Background gap color visible at octagon corners
const GAP_COLOR = "#06060a";

// --- Noise helpers ---

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Bilinear smooth noise — adjacent tiles get similar values
function smoothNoise(x: number, y: number, scale: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = (x - gx * scale) / scale;
  const fy = (y - gy * scale) / scale;
  // Smoothstep
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (
    hash2(gx,     gy)     * (1 - ux) * (1 - uy) +
    hash2(gx + 1, gy)     * ux       * (1 - uy) +
    hash2(gx,     gy + 1) * (1 - ux) * uy +
    hash2(gx + 1, gy + 1) * ux       * uy
  );
}

// Two octaves of smooth noise → richer terrain variation
function terrainNoise(x: number, y: number): number {
  return smoothNoise(x, y, 9) * 0.65 + smoothNoise(x, y, 3) * 0.35;
}

// --- Grain texture (generated once, cached) ---

let _grainPattern: CanvasPattern | null = null;

function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (_grainPattern) return _grainPattern;
  try {
    const size = 128;
    const oc = new OffscreenCanvas(size, size);
    const oc2 = oc.getContext("2d")!;
    const img = oc2.createImageData(size, size);
    const d = img.data;
    // LCG pseudo-random — deterministic, no seeding dependency
    let s = 0x9e3779b9;
    const rng = () => {
      s = ((s * 1664525 + 1013904223) | 0) >>> 0;
      return s / 0xffffffff;
    };
    for (let i = 0; i < size * size; i++) {
      const v = Math.floor(rng() * 210 + 20);
      d[i * 4]     = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = Math.floor(rng() * 32 + 6);
    }
    oc2.putImageData(img, 0, 0);
    _grainPattern = ctx.createPattern(oc, "repeat");
  } catch {
    // OffscreenCanvas unavailable (older browser) — skip grain
  }
  return _grainPattern;
}

// --- Octagon path helper ---

function octagonPath(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number) {
  const c = size * CUT;
  ctx.beginPath();
  ctx.moveTo(sx + c,          sy);
  ctx.lineTo(sx + size - c,   sy);
  ctx.lineTo(sx + size,       sy + c);
  ctx.lineTo(sx + size,       sy + size - c);
  ctx.lineTo(sx + size - c,   sy + size);
  ctx.lineTo(sx + c,          sy + size);
  ctx.lineTo(sx,              sy + size - c);
  ctx.lineTo(sx,              sy + c);
  ctx.closePath();
}

// --- Main renderer ---

export function useGameRenderer() {
  const game = useGameStore();

  function render(params: RenderParams) {
    const { ctx, state, widthPx, heightPx, tileSize, camera } = params;
    ctx.clearRect(0, 0, widthPx, heightPx);

    const scale = camera.zoom;
    const tsScreen = tileSize * scale;

    const worldLeft   = (-camera.x) / scale;
    const worldTop    = (-camera.y) / scale;
    const worldRight  = worldLeft + widthPx  / scale;
    const worldBottom = worldTop  + heightPx / scale;

    const x0 = Math.max(0,              Math.floor(worldLeft  / tileSize) - 1);
    const y0 = Math.max(0,              Math.floor(worldTop   / tileSize) - 1);
    const x1 = Math.min(state.width  - 1, Math.ceil(worldRight  / tileSize) + 1);
    const y1 = Math.min(state.height - 1, Math.ceil(worldBottom / tileSize) + 1);

    const colorByPlayer = new Map(state.players.map((p) => [p.id, p.color] as const));

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    // ── Pass 1: tiles ──────────────────────────────────────────────────────
    for (let y = y0; y <= y1; y++) {
      const sy = y * tileSize;
      for (let x = x0; x <= x1; x++) {
        const i = y * state.width + x;
        const type      = state.tiles.types[i]     as TileType;
        const owner     = state.tiles.owners[i];
        const building  = state.tiles.buildings[i] as BuildingType | null;

        const base       = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;
        const sx         = x * tileSize;
        const noise      = terrainNoise(x, y); // [0,1]

        // 1a. Gap color — fills the full square; octagon corners will expose it
        ctx.fillStyle = GAP_COLOR;
        ctx.fillRect(sx, sy, tileSize, tileSize);

        // 1b. Octagon base color
        octagonPath(ctx, sx, sy, tileSize);
        ctx.fillStyle = base;
        ctx.fill();

        // 1c. Smooth noise brightness variation (±8 % luminosity)
        octagonPath(ctx, sx, sy, tileSize);
        if (noise > 0.5) {
          ctx.fillStyle = `rgba(255,255,255,${((noise - 0.5) * 0.16).toFixed(3)})`;
        } else {
          ctx.fillStyle = `rgba(0,0,0,${((0.5 - noise) * 0.14).toFixed(3)})`;
        }
        ctx.fill();

        // 1d. Water — extra subtle highlight variation from secondary noise
        if (type === TileType.Water) {
          const wn = smoothNoise(x, y, 5);
          octagonPath(ctx, sx, sy, tileSize);
          ctx.fillStyle = `rgba(96,165,250,${(wn * 0.09).toFixed(3)})`;
          ctx.fill();
        }

        // 1e. Owner color
        if (ownerColor) {
          octagonPath(ctx, sx, sy, tileSize);
          ctx.fillStyle = ownerColor;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // 1f. Bevel (etched highlight / shadow) — only when tiles are large enough
        if (tsScreen >= 10) {
          const c = tileSize * CUT;
          ctx.lineWidth = 1.2 / scale;

          // Top-left lit faces
          ctx.beginPath();
          ctx.moveTo(sx,          sy + c);
          ctx.lineTo(sx + c,      sy);
          ctx.lineTo(sx + tileSize - c, sy);
          ctx.strokeStyle = "rgba(255,255,255,0.20)";
          ctx.stroke();

          // Bottom-right shadow faces
          ctx.beginPath();
          ctx.moveTo(sx + tileSize,        sy + c);
          ctx.lineTo(sx + tileSize,        sy + tileSize - c);
          ctx.lineTo(sx + tileSize - c,    sy + tileSize);
          ctx.lineTo(sx + c,               sy + tileSize);
          ctx.strokeStyle = "rgba(0,0,0,0.30)";
          ctx.stroke();

          // Outline
          octagonPath(ctx, sx, sy, tileSize);
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 0.5 / scale;
          ctx.stroke();
        }

        // 1g. Terrain icons
        if (tsScreen >= 28) {
          const icon =
            type === TileType.Water  ? "water"      :
            type === TileType.Forest ? "park"        :
            type === TileType.Quarry ? "filter_hdr"  : "";
          if (icon) {
            ctx.fillStyle =
              type === TileType.Water  ? "rgba(96,165,250,0.35)"  :
              type === TileType.Forest ? "rgba(34,197,94,0.30)"   :
                                         "rgba(168,162,158,0.35)";
            ctx.font = `${Math.max(18 / scale, tileSize * 0.52)}px "Material Symbols Outlined"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(icon, sx + tileSize / 2, sy + tileSize / 2);
          }
        }

        // 1h. Buildings
        if (building != null && building !== BuildingType.Wonder) {
          const isBase = building === BuildingType.Base;
          const iconPx = tileSize * (isBase ? 0.58 : 0.48);
          const bgPx   = tileSize * (isBase ? 0.76 : 0.65);
          const cx2    = sx + tileSize / 2;
          const cy2    = sy + tileSize / 2;

          ctx.fillStyle = "rgba(0,0,0,0.62)";
          ctx.fillRect(cx2 - bgPx / 2, cy2 - bgPx / 2, bgPx, bgPx);

          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.font = `${iconPx}px "Material Symbols Outlined"`;

          let bIcon = "help", bColor = "rgba(255,255,255,0.95)";
          switch (building) {
            case BuildingType.Base:       bIcon = "location_city";   bColor = "rgba(255,255,255,0.98)"; break;
            case BuildingType.Barracks:   bIcon = "shield";          bColor = "rgba(255,175,175,0.95)"; break;
            case BuildingType.University: bIcon = "history_edu";     bColor = "rgba(175,210,255,0.95)"; break;
            case BuildingType.City:       bIcon = "account_balance"; bColor = "rgba(135,200,255,0.95)"; break;
            case BuildingType.Sawmill:    bIcon = "forest";          bColor = "rgba(155,240,155,0.95)"; break;
            case BuildingType.Mine:       bIcon = "construction";    bColor = "rgba(255,215,135,0.95)"; break;
            case BuildingType.FishingHut: bIcon = "sailing";         bColor = "rgba(135,215,255,0.95)"; break;
            case BuildingType.Bridge:     bIcon = "water";           bColor = "rgba(251,191,36,0.95)";  break;
          }
          ctx.fillStyle = bColor;
          ctx.fillText(bIcon, cx2, cy2);
        }
      }
    }

    // ── Pass 2: wonders (multi-tile overlay, keep as rectangles) ──────────
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * state.width + x;
        if ((state.tiles.buildings[i] as BuildingType) !== BuildingType.Wonder) continue;
        const owner      = state.tiles.owners[i];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#f2ca50") : "#f2ca50";

        const cx   = (x + 0.5) * tileSize;
        const cy   = (y + 0.5) * tileSize;
        const half = tileSize * 2;

        const left   = Math.max(0,                    cx - half);
        const top    = Math.max(0,                    cy - half);
        const right  = Math.min(state.width  * tileSize, cx + half);
        const bottom = Math.min(state.height * tileSize, cy + half);

        ctx.fillStyle = rgba(ownerColor, 0.18);
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.strokeStyle = rgba(ownerColor, 0.7);
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.setLineDash([]);

        ctx.fillStyle = rgba(ownerColor, 0.95);
        ctx.font = `${Math.min(tileSize * 3, Math.max(12 / scale, tileSize * 1.5))}px "Material Symbols Outlined"`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("temple_hindu", cx, cy);
      }
    }

    // ── Pass 3: optimistic claims ─────────────────────────────────────────
    const myPlayerId = game.mePlayer?.id ?? null;
    const myColor    = myPlayerId ? colorByPlayer.get(myPlayerId) ?? null : null;

    for (const key of Object.keys(game.optimisticClaims)) {
      const [xStr, yStr] = key.split(",");
      const cx = Number(xStr);
      const cy = Number(yStr);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
      const sx = cx * tileSize;
      const sy = cy * tileSize;
      octagonPath(ctx, sx, sy, tileSize);
      ctx.fillStyle = myColor ? lighten(myColor, 0.45) : rgba("#ffffff", 0.08);
      ctx.fill();
      octagonPath(ctx, sx, sy, tileSize);
      ctx.strokeStyle = myColor ? rgba(myColor, 0.35) : rgba("#ffffff", 0.12);
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }

    // ── Pass 4: brouillage ────────────────────────────────────────────────
    const now = Date.now();
    for (const b of state.brouillage ?? []) {
      if (b.expiresAt <= now) continue;
      const sx = b.x * tileSize;
      const sy = b.y * tileSize;
      const c  = tileSize * CUT;
      octagonPath(ctx, sx, sy, tileSize);
      ctx.fillStyle = rgba("#ef4444", 0.12);
      ctx.fill();
      // Diagonal stays within the octagon bounds
      ctx.strokeStyle = rgba("#ef4444", 0.35);
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(sx + c,              sy);
      ctx.lineTo(sx + tileSize,       sy + tileSize - c);
      ctx.stroke();
    }

    // ── Pass 5: attack warnings (pulsing) ─────────────────────────────────
    for (const w of game.attackWarnings) {
      if (w.expiresAt <= now) continue;
      if (w.x < x0 || w.x > x1 || w.y < y0 || w.y > y1) continue;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(now / 160));
      const sx = w.x * tileSize;
      const sy = w.y * tileSize;
      octagonPath(ctx, sx, sy, tileSize);
      ctx.fillStyle = rgba("#ef4444", 0.30 * pulse);
      ctx.fill();
      octagonPath(ctx, sx, sy, tileSize);
      ctx.strokeStyle = rgba("#ef4444", pulse);
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
    }

    // ── Pass 6: hover ─────────────────────────────────────────────────────
    if (params.hovered) {
      const sx = params.hovered.x * tileSize;
      const sy = params.hovered.y * tileSize;
      octagonPath(ctx, sx, sy, tileSize);
      ctx.strokeStyle = rgba("#60a5fa", 0.9);
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }

    ctx.restore();

    // ── Screen-space grain overlay (one fill, efficient) ──────────────────
    // Applied after restore() so the pattern tiles at actual screen pixels.
    const grain = getGrainPattern(ctx);
    if (grain) {
      ctx.fillStyle = grain;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.globalAlpha = 1;
    }
  }

  return { render };
}
