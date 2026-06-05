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
  [TileType.Plain]:  "#c8af78",
  [TileType.Water]:  "rgba(30, 58, 138, 0.40)",
  [TileType.Forest]: "rgba(20, 83, 45, 0.45)",
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

// Append a pointy-top hex to an existing Path2D (no beginPath — used for batching)
function addHexToPath(path: Path2D, cx: number, cy: number, R: number): void {
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + R * Math.cos(a);
    const y = cy + R * Math.sin(a);
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
}

// --- Terrain noise pre-computed once per map dimensions ---

let _noiseCache: Float32Array | null = null;
let _waterNoiseCache: Float32Array | null = null;
let _noiseCacheW = 0;
let _noiseCacheH = 0;

function ensureNoiseCache(width: number, height: number) {
  if (_noiseCache && _noiseCacheW === width && _noiseCacheH === height) return;
  _noiseCache      = new Float32Array(width * height);
  _waterNoiseCache = new Float32Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const i = r * width + c;
      _noiseCache[i]      = terrainNoise(c, r);
      _waterNoiseCache[i] = smoothNoise(c, r, 5);
    }
  }
  _noiseCacheW = width;
  _noiseCacheH = height;
}

// --- colorByPlayer cache — players & colors never change during a game ---

let _colorByPlayer: Map<string, string> | null = null;
let _colorCacheKey = "";

function getColorByPlayer(state: { gameId: string; players: { id: string; color: string }[] }): Map<string, string> {
  const key = state.gameId + ":" + state.players.length;
  if (_colorByPlayer && _colorCacheKey === key) return _colorByPlayer;
  _colorByPlayer = new Map(state.players.map(p => [p.id, p.color]));
  _colorCacheKey = key;
  return _colorByPlayer;
}

// --- Wonder tiles cache — updated only when wonder count changes ---

let _wonderTiles: Array<{ col: number; row: number; ownerId: string | null }> | null = null;
let _wonderCacheKey = "";

function getWonderTiles(state: { gameId: string; tiles: { buildings: (number | null)[]; owners: (string | null)[] }; width: number; wonders?: unknown[] }): Array<{ col: number; row: number; ownerId: string | null }> {
  const key = state.gameId + ":" + (state.wonders?.length ?? 0);
  if (_wonderTiles && _wonderCacheKey === key) return _wonderTiles;
  _wonderTiles = [];
  for (let i = 0; i < state.tiles.buildings.length; i++) {
    if ((state.tiles.buildings[i] as BuildingType) === BuildingType.Wonder) {
      _wonderTiles.push({ col: i % state.width, row: Math.floor(i / state.width), ownerId: state.tiles.owners[i] });
    }
  }
  _wonderCacheKey = key;
  return _wonderTiles;
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

    ensureNoiseCache(state.width, state.height);
    const colorByPlayer = getColorByPlayer(state);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    // ── Pass 1: tiles ──────────────────────────────────────────────────────
    if (tsScreen < 10) {
      // ── FAST PATH: batched fills — one fill() per color group ─────────────
      // At this zoom tiles are < 10px; noise, bevel, outlines and icons are
      // invisible. Batching 9 800 hexes into ~15 fill() calls vs ~50 000.
      const basePaths  = new Map<string, Path2D>();
      const ownerPaths = new Map<string, Path2D>();

      for (let row = y0; row <= y1; row++) {
        for (let col = x0; col <= x1; col++) {
          const i          = row * state.width + col;
          const type       = state.tiles.types[i] as TileType;
          const owner      = state.tiles.owners[i];
          const base       = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
          const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;
          const { x: cx, y: cy } = hexCenter(col, row, tileSize);

          if (!basePaths.has(base)) basePaths.set(base, new Path2D());
          addHexToPath(basePaths.get(base)!, cx, cy, R);

          if (ownerColor) {
            if (!ownerPaths.has(ownerColor)) ownerPaths.set(ownerColor, new Path2D());
            addHexToPath(ownerPaths.get(ownerColor)!, cx, cy, R);
          }
        }
      }

      // 4 fills max for tile types
      for (const [color, path] of basePaths) {
        ctx.fillStyle = color;
        ctx.fill(path);
      }
      // 1 fill per player for ownership (typically 2–10 fills)
      ctx.globalAlpha = 0.85;
      for (const [color, path] of ownerPaths) {
        ctx.fillStyle = color;
        ctx.fill(path);
      }
      ctx.globalAlpha = 1;

    } else {
      // ── FULL QUALITY: per-tile with noise, bevel, outlines, icons ─────────
      for (let row = y0; row <= y1; row++) {
        for (let col = x0; col <= x1; col++) {
          const i        = row * state.width + col;
          const type     = state.tiles.types[i]     as TileType;
          const owner    = state.tiles.owners[i];
          const building = state.tiles.buildings[i] as BuildingType | null;

          const base       = TILE_COLORS[type] ?? TILE_COLORS[TileType.Plain];
          const ownerColor = owner ? (colorByPlayer.get(owner) ?? "#64748b") : null;

          const { x: cx, y: cy } = hexCenter(col, row, tileSize);
          const ni    = row * state.width + col;
          const noise = _noiseCache![ni];

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
            const wn = _waterNoiseCache![ni];
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

          // 1e. Bevel + outline (tsScreen >= 10 guaranteed here)
          // Water, Forest, Quarry: seamless interiors — only border edges facing a different type
          if (type === TileType.Plain) {
            hexBevel(ctx, cx, cy, R, scale);
            hexPathAt(ctx, cx, cy, R);
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth   = 0.5 / scale;
            ctx.stroke();
          } else {
            const nbrs = hexNeighbors(col, row);
            const borderColor =
              type === TileType.Water  ? "rgba(96, 165, 250, 0.50)"  :
              type === TileType.Forest ? "rgba(34, 197, 94,  0.45)"  :
                                         "rgba(168, 162, 158, 0.50)";
            ctx.lineWidth = 0.8 / scale;
            for (let e = 0; e < 6; e++) {
              const [nc, nr] = nbrs[e];
              if (nc >= 0 && nc < state.width && nr >= 0 && nr < state.height) {
                // Skip the edge if the neighbor is the same type
                if ((state.tiles.types[nr * state.width + nc] as TileType) === type) continue;
              }
              const a1 = (Math.PI / 3) * e       - Math.PI / 2;
              const a2 = (Math.PI / 3) * (e + 1) - Math.PI / 2;
              ctx.beginPath();
              ctx.moveTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1));
              ctx.lineTo(cx + R * Math.cos(a2), cy + R * Math.sin(a2));
              ctx.strokeStyle = borderColor;
              ctx.stroke();
            }
          }

          // 1f. Terrain icons
          if (tsScreen >= 28) {
            const icon =
              type === TileType.Forest ? "park"       :
              type === TileType.Quarry ? "filter_hdr" : "";
            if (icon) {
              ctx.fillStyle =
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

            ctx.beginPath();
            ctx.arc(cx, cy, bgR2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(8, 8, 14, 0.80)";
            ctx.fill();
            ctx.strokeStyle = ownerColor ? `${ownerColor}55` : "rgba(255,255,255,0.12)";
            ctx.lineWidth   = 1 / scale;
            ctx.stroke();

            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";

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
            const useEmoji = (bIcon.codePointAt(0) ?? 0) > 127;
            ctx.font = useEmoji
              ? `${iconPx}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
              : `${iconPx}px "Material Symbols Outlined"`;
            ctx.fillStyle = bColor;
            ctx.fillText(bIcon, cx, cy);
          }
        }
      }
    }

    // ── Pass 2: wonders (multi-hex bounding box overlay) ──────────────────
    for (const { col, row, ownerId } of getWonderTiles(state)) {
      if (col < x0 || col > x1 || row < y0 || row > y1) continue;
      {
        const ownerColor = ownerId ? (colorByPlayer.get(ownerId) ?? "#f2ca50") : "#f2ca50";

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

    // ── Pass 7: maritime animations (one boat per active landing) ────────────
    for (const anim of game.maritimeAnimations) {
      const step = Math.min(anim.step, anim.path.length - 1);
      const pos  = anim.path[step];
      const { x: cx, y: cy } = hexCenter(pos.x, pos.y, tileSize);
      const boatSize = Math.max(R * 1.6, 18 / scale);

      // Wake shadow
      ctx.globalAlpha = 0.35;
      ctx.fillStyle   = "#0a1a3a";
      ctx.beginPath();
      ctx.ellipse(cx, cy + R * 0.3, R * 0.7, R * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Boat emoji
      ctx.font         = `${boatSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🚢", cx, cy);
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
