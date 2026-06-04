import type { GameStateSnapshot } from "../types/game";
import { BuildingType, TileType } from "../types/game";
import { lighten, rgba } from "../utils/colors";
import { useGameStore } from "../stores/gameStore";
import {
  hexR,
  hexW,
  hexVertStep,
  hexCenter,
  hexPathAt,
  hexBevel,
} from "../utils/hexGrid";

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
  [TileType.Plain]:  "#131312",
  [TileType.Water]:  "rgba(30, 58, 138, 0.40)",
  [TileType.Forest]: "rgba(20, 83, 45, 0.22)",
  [TileType.Quarry]: "rgba(68, 64, 60, 0.35)",
};

const OUTLINE = "rgba(77, 70, 53, 0.85)";

// The 6 neighbours of hex (col, row) in edge order (NE, E, SE, SW, W, NW)
// matching vertex pairs 0-1, 1-2, 2-3, 3-4, 4-5, 5-0
function hexNeighbors(col: number, row: number): [number, number][] {
  return row % 2 === 0
    ? [[col, row-1], [col+1, row], [col, row+1], [col-1, row+1], [col-1, row], [col-1, row-1]]
    : [[col+1, row-1], [col+1, row], [col+1, row+1], [col, row+1], [col-1, row], [col, row-1]];
}

// --- Terrain noise (smooth, two-octave) ---

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, scale: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = (x - gx * scale) / scale;
  const fy = (y - gy * scale) / scale;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (
    hash2(gx,     gy)     * (1 - ux) * (1 - uy) +
    hash2(gx + 1, gy)     * ux       * (1 - uy) +
    hash2(gx,     gy + 1) * (1 - ux) * uy       +
    hash2(gx + 1, gy + 1) * ux       * uy
  );
}

function terrainNoise(x: number, y: number): number {
  return smoothNoise(x, y, 9) * 0.65 + smoothNoise(x, y, 3) * 0.35;
}

// --- Screen-space grain texture (generated once) ---

let _grainPattern: CanvasPattern | null = null;

function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (_grainPattern) return _grainPattern;
  try {
    const size = 128;
    const oc   = new OffscreenCanvas(size, size);
    const oc2  = oc.getContext("2d")!;
    const img  = oc2.createImageData(size, size);
    const d    = img.data;
    let s = 0x9e3779b9;
    const rng = () => { s = ((s * 1664525 + 1013904223) | 0) >>> 0; return s / 0xffffffff; };
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
    // OffscreenCanvas unavailable — skip grain
  }
  return _grainPattern;
}

// --- Main renderer ---

export function useGameRenderer() {
  const game = useGameStore();

  function render(params: RenderParams) {
    const { ctx, state, widthPx, heightPx, tileSize, camera } = params;

    ctx.fillStyle = "#08080c";
    ctx.fillRect(0, 0, widthPx, heightPx);

    const scale  = camera.zoom;
    const tsScreen = tileSize * scale;

    const R = hexR(tileSize);
    const W = hexW(tileSize);
    const VS = hexVertStep(tileSize); // vertical step between row centers

    const worldLeft   = -camera.x / scale;
    const worldTop    = -camera.y / scale;
    const worldRight  = worldLeft + widthPx  / scale;
    const worldBottom = worldTop  + heightPx / scale;

    // Conservative tile culling for the offset hex grid
    const y0 = Math.max(0,              Math.floor((worldTop    - R) / VS) - 2);
    const y1 = Math.min(state.height - 1, Math.ceil((worldBottom - R) / VS) + 2);
    const x0 = Math.max(0,              Math.floor( worldLeft        / W)  - 2);
    const x1 = Math.min(state.width  - 1, Math.ceil( worldRight      / W)  + 2);

    const colorByPlayer = new Map(state.players.map((p) => [p.id, p.color] as const));

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    // ── Pass 1: tiles ──────────────────────────────────────────────────────
    for (let row = y0; row <= y1; row++) {
      for (let col = x0; col <= x1; col++) {
        const i        = row * state.width + col;
        const type     = state.tiles.types[i]     as TileType;
        const owner    = state.tiles.owners[i];
        const building = state.tiles.buildings[i] as BuildingType | null;

        const base       = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;

        const { x: cx, y: cy } = hexCenter(col, row, tileSize);
        const noise = terrainNoise(col, row);

        // 1a. Base fill
        hexPathAt(ctx, cx, cy, R);
        ctx.fillStyle = base;
        ctx.fill();

        // 1b. Smooth noise brightness variation (±8%)
        hexPathAt(ctx, cx, cy, R);
        ctx.fillStyle = noise > 0.5
          ? `rgba(255,255,255,${((noise - 0.5) * 0.16).toFixed(3)})`
          : `rgba(0,0,0,${((0.5 - noise) * 0.14).toFixed(3)})`;
        ctx.fill();

        // 1c. Water — additional reflective highlight from secondary noise
        if (type === TileType.Water) {
          const wn = smoothNoise(col, row, 5);
          hexPathAt(ctx, cx, cy, R);
          ctx.fillStyle = `rgba(96,165,250,${(wn * 0.09).toFixed(3)})`;
          ctx.fill();
        }

        // 1d. Owner color
        if (ownerColor) {
          hexPathAt(ctx, cx, cy, R);
          ctx.fillStyle   = ownerColor;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // 1e. Bevel + outline
        if (tsScreen >= 10) {
          if (type !== TileType.Water) {
            hexBevel(ctx, cx, cy, R, scale);
            hexPathAt(ctx, cx, cy, R);
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth   = 0.5 / scale;
            ctx.stroke();
          } else {
            // Only draw coastline edges — skip edges shared with other water tiles
            const nbrs = hexNeighbors(col, row);
            ctx.lineWidth = 0.8 / scale;
            for (let e = 0; e < 6; e++) {
              const [nc, nr] = nbrs[e];
              if (nc >= 0 && nc < state.width && nr >= 0 && nr < state.height) {
                if ((state.tiles.types[nr * state.width + nc] as TileType) === TileType.Water) continue;
              }
              const a1 = (Math.PI / 3) * e       - Math.PI / 2;
              const a2 = (Math.PI / 3) * (e + 1) - Math.PI / 2;
              ctx.beginPath();
              ctx.moveTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1));
              ctx.lineTo(cx + R * Math.cos(a2), cy + R * Math.sin(a2));
              ctx.strokeStyle = "rgba(96, 165, 250, 0.50)";
              ctx.stroke();
            }
          }
        }

        // 1f. Terrain icons
        if (tsScreen >= 28) {
          const icon =
            type === TileType.Water  ? "water"     :
            type === TileType.Forest ? "park"       :
            type === TileType.Quarry ? "filter_hdr" : "";
          if (icon) {
            ctx.fillStyle =
              type === TileType.Water  ? "rgba(96,165,250,0.35)"  :
              type === TileType.Forest ? "rgba(34,197,94,0.30)"   :
                                         "rgba(168,162,158,0.35)";
            ctx.font          = `${Math.max(18 / scale, R * 0.9)}px "Material Symbols Outlined"`;
            ctx.textAlign     = "center";
            ctx.textBaseline  = "middle";
            ctx.fillText(icon, cx, cy);
          }
        }

        // 1g. Buildings
        if (building != null && building !== BuildingType.Wonder) {
          const isBase = building === BuildingType.Base;
          const iconPx = R * (isBase ? 1.15 : 0.95);
          const bgR2   = R * (isBase ? 0.80 : 0.68);

          // Circular badge — no more black square
          ctx.beginPath();
          ctx.arc(cx, cy, bgR2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(8, 8, 14, 0.80)";
          ctx.fill();
          ctx.strokeStyle = ownerColor ? `${ownerColor}55` : "rgba(255,255,255,0.12)";
          ctx.lineWidth   = 1 / scale;
          ctx.stroke();

          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.font         = `${iconPx}px "Material Symbols Outlined"`;

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
          ctx.fillText(bIcon, cx, cy);
        }
      }
    }

    // ── Pass 2: wonders (multi-hex bounding box overlay) ──────────────────
    for (let row = y0; row <= y1; row++) {
      for (let col = x0; col <= x1; col++) {
        const i = row * state.width + col;
        if ((state.tiles.buildings[i] as BuildingType) !== BuildingType.Wonder) continue;
        const owner      = state.tiles.owners[i];
        const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#f2ca50") : "#f2ca50";

        const { x: cx, y: cy } = hexCenter(col, row, tileSize);
        const half = R * 4;

        const left   = Math.max(0,                    cx - half);
        const top    = Math.max(0,                    cy - half);
        const right  = Math.min(state.width  * W * 2, cx + half);
        const bottom = Math.min(state.height * VS,    cy + half);

        ctx.fillStyle = rgba(ownerColor, 0.18);
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.strokeStyle = rgba(ownerColor, 0.7);
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.setLineDash([]);

        ctx.fillStyle    = rgba(ownerColor, 0.95);
        ctx.font         = `${Math.min(R * 6, Math.max(12 / scale, R * 3))}px "Material Symbols Outlined"`;
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
      const col = Number(xStr);
      const row = Number(yStr);
      if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
      if (col < x0 || col > x1 || row < y0 || row > y1) continue;
      const { x: cx, y: cy } = hexCenter(col, row, tileSize);
      hexPathAt(ctx, cx, cy, R);
      ctx.fillStyle = myColor ? lighten(myColor, 0.45) : rgba("#ffffff", 0.08);
      ctx.fill();
      hexPathAt(ctx, cx, cy, R);
      ctx.strokeStyle = myColor ? rgba(myColor, 0.35) : rgba("#ffffff", 0.12);
      ctx.lineWidth   = 1 / scale;
      ctx.stroke();
    }

    // ── Pass 4: brouillage ────────────────────────────────────────────────
    const now = Date.now();
    for (const b of state.brouillage ?? []) {
      if (b.expiresAt <= now) continue;
      const { x: cx, y: cy } = hexCenter(b.x, b.y, tileSize);
      hexPathAt(ctx, cx, cy, R);
      ctx.fillStyle = rgba("#ef4444", 0.12);
      ctx.fill();
      // Diagonal confined to hex bounds
      ctx.strokeStyle = rgba("#ef4444", 0.35);
      ctx.lineWidth   = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.6, cy - R * 0.6);
      ctx.lineTo(cx + R * 0.6, cy + R * 0.6);
      ctx.stroke();
    }

    // ── Pass 5: attack warnings (pulsing) ─────────────────────────────────
    for (const w of game.attackWarnings) {
      if (w.expiresAt <= now) continue;
      if (w.x < x0 || w.x > x1 || w.y < y0 || w.y > y1) continue;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(now / 160));
      const { x: cx, y: cy } = hexCenter(w.x, w.y, tileSize);
      hexPathAt(ctx, cx, cy, R);
      ctx.fillStyle = rgba("#ef4444", 0.30 * pulse);
      ctx.fill();
      hexPathAt(ctx, cx, cy, R);
      ctx.strokeStyle = rgba("#ef4444", pulse);
      ctx.lineWidth   = 3 / scale;
      ctx.stroke();
    }

    // ── Pass 6: hover ─────────────────────────────────────────────────────
    if (params.hovered) {
      const { x: cx, y: cy } = hexCenter(params.hovered.x, params.hovered.y, tileSize);
      hexPathAt(ctx, cx, cy, R);
      ctx.strokeStyle = rgba("#60a5fa", 0.9);
      ctx.lineWidth   = 2 / scale;
      ctx.stroke();
    }

    ctx.restore();

    // ── Screen-space grain overlay (one fill, efficient) ──────────────────
    const grain = getGrainPattern(ctx);
    if (grain) {
      ctx.fillStyle   = grain;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.globalAlpha = 1;
    }
  }

  return { render };
}
