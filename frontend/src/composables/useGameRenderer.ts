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
  [TileType.Forest]: "rgba(55, 145, 75, 0.58)",
  [TileType.Quarry]: "rgba(175, 160, 140, 0.65)",
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

          // 1g. Buildings (sauf Wonder et Catapult dessinés séparément)
          if (building != null && building !== BuildingType.Wonder && building !== BuildingType.Catapult) {
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
              case BuildingType.Catapult:   bIcon = "target";          bColor = "rgba(251,146,60,0.95)";  break;
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

    // ── Pass 2b: trébuchets (catapultes Aurélien) ────────────────────────────
    {
      const nowT = Date.now();
      for (let i = 0; i < state.tiles.buildings.length; i++) {
        if (state.tiles.buildings[i] !== BuildingType.Catapult) continue;
        const col = i % state.width; const row = Math.floor(i / state.width);
        if (col < x0 || col > x1 || row < y0 || row > y1) continue;
        const ownerId = state.tiles.owners[i];
        const ownerColor = ownerId ? (colorByPlayer.get(ownerId) ?? "#f2ca50") : "#f2ca50";
        const { x: cx, y: cy } = hexCenter(col, row, tileSize);

        // Flash animation si tir récent
        const flash = (game.catapultFlashes ?? []).find(f =>
          f.center.x === col && f.center.y === row && nowT - f.startedAt < 800
        );
        const isOnCooldown = game.catapultCooldownEnds > nowT;
        const armAngle = flash
          ? -Math.PI/3 + (Math.PI * ((nowT - flash.startedAt) / 700))
          : -Math.PI / 3;

        const lw = Math.max(1, 1.5 / scale);
        const brown = "#8B5E3C";

        ctx.save();
        ctx.translate(cx, cy);

        // Fond hexagonal
        hexPathAt(ctx, cx - cx, cy - cy, R);
        ctx.fillStyle = rgba(ownerColor, 0.15);
        ctx.fill();

        // Base (barre horizontale)
        ctx.strokeStyle = brown; ctx.lineWidth = lw * 2.5;
        ctx.beginPath(); ctx.moveTo(-R*0.42, R*0.52); ctx.lineTo(R*0.42, R*0.52); ctx.stroke();

        // Jambe gauche
        ctx.beginPath(); ctx.moveTo(-R*0.35, R*0.5); ctx.lineTo(-R*0.06, -R*0.18); ctx.stroke();
        // Jambe droite
        ctx.beginPath(); ctx.moveTo(R*0.35, R*0.5); ctx.lineTo(R*0.06, -R*0.18); ctx.stroke();
        // Traverse
        ctx.beginPath(); ctx.moveTo(-R*0.25, R*0.22); ctx.lineTo(R*0.25, R*0.22); ctx.lineWidth = lw*1.5; ctx.stroke();

        // Pivot
        const pX = 0, pY = -R*0.18;
        ctx.beginPath(); ctx.arc(pX, pY, R*0.07, 0, Math.PI*2);
        ctx.fillStyle = "#5a3a1a"; ctx.fill();

        // Bras rotatif
        ctx.save();
        ctx.translate(pX, pY);
        ctx.rotate(armAngle);

        // Bras long
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R*0.88);
        ctx.strokeStyle = brown; ctx.lineWidth = lw*2; ctx.stroke();

        // Bras court (contrepoids)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, R*0.38);
        ctx.lineWidth = lw*1.8; ctx.stroke();

        // Contrepoids (bloc)
        ctx.fillStyle = "#666"; ctx.strokeStyle = "#444"; ctx.lineWidth = lw;
        ctx.fillRect(-R*0.13, R*0.32, R*0.26, R*0.2); ctx.strokeRect(-R*0.13, R*0.32, R*0.26, R*0.2);

        // Corde + boulet
        ctx.beginPath(); ctx.moveTo(0, -R*0.88); ctx.lineTo(R*0.09, -R*1.08);
        ctx.strokeStyle = brown; ctx.lineWidth = lw*0.8; ctx.stroke();
        ctx.beginPath(); ctx.arc(R*0.09, -R*1.14, R*0.09, 0, Math.PI*2);
        ctx.fillStyle = "#7a7a8a"; ctx.fill();
        ctx.strokeStyle = "#555"; ctx.lineWidth = lw*0.7; ctx.stroke();

        ctx.restore();

        // Indicateur cooldown (anneau — visible uniquement pour le propriétaire)
        if (isOnCooldown && ownerId === game.mePlayer?.id) {
          const remaining = Math.max(0, game.catapultCooldownEnds - nowT) / 60000;
          ctx.beginPath();
          ctx.arc(0, 0, R*0.92, -Math.PI/2, -Math.PI/2 + (1 - remaining) * Math.PI*2);
          ctx.strokeStyle = rgba(ownerColor, 0.5); ctx.lineWidth = 2/scale; ctx.stroke();
        }

        ctx.restore();
      }

      // Preview de ciblage
      if (game.catapultTargetingMode && params.hovered) {
        const hx = params.hovered.x; const hy = params.hovered.y;
        const { x: hcx, y: hcy } = hexCenter(hx, hy, tileSize);
        // Cercle de zone
        ctx.beginPath(); ctx.arc(hcx, hcy, R*2.5, 0, Math.PI*2);
        ctx.fillStyle = "rgba(251,146,60,0.12)";
        ctx.fill();
        ctx.strokeStyle = "rgba(251,146,60,0.7)"; ctx.lineWidth = 2/scale;
        ctx.setLineDash([4/scale, 3/scale]); ctx.stroke(); ctx.setLineDash([]);
        // Croix centrale
        ctx.strokeStyle = "rgba(251,146,60,0.9)"; ctx.lineWidth = 1.5/scale;
        ctx.beginPath(); ctx.moveTo(hcx - R*0.4, hcy); ctx.lineTo(hcx + R*0.4, hcy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hcx, hcy - R*0.4); ctx.lineTo(hcx, hcy + R*0.4); ctx.stroke();
      }
    }

    // ── Pass 2: wonders (single hex, prominent) ───────────────────────────
    for (const { col, row, ownerId } of getWonderTiles(state)) {
      if (col < x0 || col > x1 || row < y0 || row > y1) continue;

      const ownerColor = ownerId ? (colorByPlayer.get(ownerId) ?? "#f2ca50") : "#f2ca50";
      const { x: cx, y: cy } = hexCenter(col, row, tileSize);

      // Hex background
      hexPathAt(ctx, cx, cy, R);
      ctx.fillStyle = rgba(ownerColor, 0.30);
      ctx.fill();

      // Glowing border
      ctx.save();
      ctx.shadowColor = ownerColor;
      ctx.shadowBlur  = R * 2;
      hexPathAt(ctx, cx, cy, R * 0.93);
      ctx.strokeStyle = rgba(ownerColor, 0.95);
      ctx.lineWidth   = 2.5 / scale;
      ctx.stroke();
      ctx.restore();

      // Icon
      ctx.fillStyle    = "#f2ca50";
      ctx.font         = `${R * 1.2}px "Material Symbols Outlined"`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("temple_hindu", cx, cy);
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

    // ── Pass 5: forêts maudites (Elfes — effet violet poison) ────────────────
    {
      const nowF = Date.now();
      for (const cursed of (game.cursedForestTiles ?? [])) {
        if (nowF > cursed.endsAt) continue;
        if (cursed.x < x0 || cursed.x > x1 || cursed.y < y0 || cursed.y > y1) continue;
        const { x: cx, y: cy } = hexCenter(cursed.x, cursed.y, tileSize);
        const elapsed = (nowF - (cursed.endsAt - 60_000)) / 1000; // secondes depuis le cast
        const lifeRatio = 1 - (nowF - (cursed.endsAt - 60_000)) / 60_000; // 1 → 0 sur 60s
        const pulse = 0.6 + 0.4 * Math.sin(elapsed * 4.5);

        // Fond violet sombre
        hexPathAt(ctx, cx, cy, R);
        ctx.fillStyle = `rgba(88,28,135,${0.55 * lifeRatio})`;
        ctx.fill();

        // Brume toxique (overlay gradient)
        hexPathAt(ctx, cx, cy, R);
        ctx.fillStyle = `rgba(168,85,247,${0.25 * pulse * lifeRatio})`;
        ctx.fill();

        // Bordure lumineuse violette
        ctx.save();
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = R * 2.5;
        hexPathAt(ctx, cx, cy, R * 0.88);
        ctx.strokeStyle = `rgba(216,180,254,${0.85 * pulse * lifeRatio})`;
        ctx.lineWidth = 2.5 / scale;
        ctx.stroke();
        ctx.restore();

        // Particules / wisps toxiques
        const seed = cursed.x * 31 + cursed.y * 17;
        for (let p = 0; p < 5; p++) {
          const angle = ((seed + p * 72) % 360) * Math.PI / 180 + elapsed * (0.5 + p * 0.15);
          const dist  = R * (0.3 + (p % 3) * 0.18);
          const px2 = cx + Math.cos(angle) * dist;
          const py2 = cy + Math.sin(angle) * dist + Math.sin(elapsed * 2 + p) * R * 0.12;
          const pSize = Math.max(1.5 / scale, R * (0.06 + (p % 2) * 0.04));
          ctx.beginPath();
          ctx.arc(px2, py2, pSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(216,180,254,${(0.5 + 0.5 * Math.sin(elapsed * 3 + p)) * lifeRatio})`;
          ctx.fill();
        }

        // Icône crâne / malédiction au centre
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.max(R * 0.7, 8 / scale)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
        ctx.globalAlpha = 0.7 * pulse * lifeRatio;
        ctx.fillText("☠", cx, cy);
        ctx.globalAlpha = 1;
      }
    }

    // ── Pass 6b: attack warnings (pulsing) ────────────────────────────────
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

    // ── Pass 7: fishing boats (ambient — floats near each port) ─────────────
    {
      const now7 = Date.now();
      // Build a map: ownerId → list of port positions (sorted by tile index for stable distribution)
      const portsByOwner = new Map<string, Array<{ col: number; row: number }>>();
      for (let i = 0; i < state.tiles.buildings.length; i++) {
        if (state.tiles.buildings[i] !== BuildingType.FishingHut) continue;
        const ownerId = state.tiles.owners[i];
        if (!ownerId) continue;
        const col = i % state.width;
        const row = Math.floor(i / state.width);
        if (!portsByOwner.has(ownerId)) portsByOwner.set(ownerId, []);
        portsByOwner.get(ownerId)!.push({ col, row });
      }

      for (const player of state.players) {
        const pfb = (player as any).portFishingBoats as Record<string, number> | undefined;
        const ports = portsByOwner.get(player.id) ?? [];

        for (let portIdx = 0; portIdx < ports.length; portIdx++) {
          const { col, row } = ports[portIdx];
          const portK = `${col}_${row}`;
          const boatsHere = pfb ? (pfb[portK] ?? 0) : 0;
          if (boatsHere === 0) continue;

          // Adjacent water tiles visible on screen
          const waterTiles = hexNeighbors(col, row)
            .filter(([nc, nr]) => nc >= 0 && nc < state.width && nr >= 0 && nr < state.height)
            .filter(([nc, nr]) => (state.tiles.types[nr * state.width + nc] as TileType) === TileType.Water);

          if (waterTiles.length === 0) continue;

          for (let b = 0; b < boatsHere; b++) {
            const [wc, wr] = waterTiles[b % waterTiles.length];
            // Skip if off-screen
            if (wc < x0 - 1 || wc > x1 + 1 || wr < y0 - 1 || wr > y1 + 1) continue;

            const { x: bx, y: by } = hexCenter(wc, wr, tileSize);
            // Each boat has a unique phase so they don't all bob in sync
            const phase = now7 / 1000 + b * 2.094 + portIdx * 5.1;
            const bobX = Math.sin(phase * 0.85) * R * 0.20;
            const bobY = Math.cos(phase * 0.65) * R * 0.14;

            const boatPx = Math.max(R * 1.25, 13 / scale);

            // Soft wake shadow
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = "#060f28";
            ctx.beginPath();
            ctx.ellipse(bx + bobX, by + R * 0.28 + bobY * 0.25, R * 0.52, R * 0.17, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            ctx.font = `${boatPx}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⛵", bx + bobX, by + bobY);
          }
        }
      }
    }

    // ── Pass 8: galions ───────────────────────────────────────────────────────
    {
      const nowG = Date.now();
      for (const galleon of (game.galleons ?? [])) {
        if (galleon.x < x0 - 1 || galleon.x > x1 + 1 || galleon.y < y0 - 1 || galleon.y > y1 + 1) continue;
        const { x: cx, y: cy } = hexCenter(galleon.x, galleon.y, tileSize);
        const ownerColor = colorByPlayer.get(galleon.playerId) ?? "#f2ca50";
        const bob = Math.sin(nowG / 700 + galleon.x * 1.3 + galleon.y * 0.7) * R * 0.08;

        // Wake shadow
        ctx.globalAlpha = 0.35;
        ctx.fillStyle   = "#060f28";
        ctx.beginPath();
        ctx.ellipse(cx, cy + bob + R * 0.45, R * 0.70, R * 0.20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // ── Dessin du galion espagnol ───────────────────────────────────────
        ctx.save();
        ctx.translate(cx, cy + bob);
        const lw = Math.max(1, 1.5 / scale);

        // Coque
        ctx.beginPath();
        ctx.moveTo(-R * 0.62, R * 0.05);
        ctx.lineTo( R * 0.62, R * 0.05);
        ctx.lineTo( R * 0.48, R * 0.52);
        ctx.lineTo(-R * 0.52, R * 0.52);
        ctx.closePath();
        ctx.fillStyle = rgba(ownerColor, 0.88);
        ctx.fill();
        ctx.strokeStyle = rgba(ownerColor, 1);
        ctx.lineWidth = lw;
        ctx.stroke();

        // Proue (étrave pointue à droite)
        ctx.beginPath();
        ctx.moveTo(R * 0.62, R * 0.05);
        ctx.lineTo(R * 0.88, R * 0.28);
        ctx.lineTo(R * 0.48, R * 0.52);
        ctx.closePath();
        ctx.fillStyle = rgba(ownerColor, 0.70);
        ctx.fill();

        // Mât principal (gauche)
        ctx.beginPath();
        ctx.moveTo(-R * 0.18, R * 0.05);
        ctx.lineTo(-R * 0.18, -R * 0.88);
        ctx.strokeStyle = rgba(ownerColor, 1);
        ctx.lineWidth = lw * 1.4;
        ctx.stroke();

        // Mât de misaine (droite)
        ctx.beginPath();
        ctx.moveTo(R * 0.22, R * 0.05);
        ctx.lineTo(R * 0.22, -R * 0.52);
        ctx.lineWidth = lw;
        ctx.stroke();

        // Grande voile (ivoire/blanc cassé)
        ctx.beginPath();
        ctx.moveTo(-R * 0.18, -R * 0.82);
        ctx.lineTo(-R * 0.18, -R * 0.08);
        ctx.lineTo(R * 0.20, -R * 0.26);
        ctx.lineTo(R * 0.20, -R * 0.68);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,248,210,0.90)";
        ctx.fill();
        ctx.strokeStyle = rgba(ownerColor, 0.35);
        ctx.lineWidth = lw * 0.7;
        ctx.stroke();

        // Voile de misaine
        ctx.beginPath();
        ctx.moveTo(R * 0.22, -R * 0.48);
        ctx.lineTo(R * 0.22, -R * 0.08);
        ctx.lineTo(R * 0.54, -R * 0.22);
        ctx.lineTo(R * 0.54, -R * 0.42);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,248,210,0.75)";
        ctx.fill();

        // Pavillon (rouge croix espagnole)
        ctx.beginPath();
        ctx.moveTo(-R * 0.18, -R * 0.88);
        ctx.lineTo( R * 0.10, -R * 0.75);
        ctx.lineTo(-R * 0.18, -R * 0.62);
        ctx.closePath();
        ctx.fillStyle = "#dc2626";
        ctx.fill();

        // Croix sur le pavillon
        ctx.strokeStyle = "#fef2f2";
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.moveTo(-R * 0.14, -R * 0.82); ctx.lineTo( R * 0.06, -R * 0.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-R * 0.04, -R * 0.86); ctx.lineTo(-R * 0.04, -R * 0.64);
        ctx.stroke();

        ctx.restore();

        // HP bar (seulement si endommagé)
        if (galleon.hp < 3) {
          const barW = R * 1.1;
          const barH = R * 0.18;
          const barX = cx - barW / 2;
          const barY = cy + bob - R * 0.85;
          ctx.fillStyle = rgba("#111", 0.7);
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = galleon.hp >= 2 ? "#22c55e" : "#ef4444";
          ctx.fillRect(barX, barY, barW * (galleon.hp / 3), barH);
        }
      }

      // Cannonballs
      for (const cb of (game.cannonballs ?? [])) {
        const elapsed = (nowG - cb.startedAt) / 800;
        if (elapsed >= 1) continue;
        const { x: fx, y: fy } = hexCenter(cb.from.x, cb.from.y, tileSize);
        const { x: tx, y: ty } = hexCenter(cb.to.x,   cb.to.y,   tileSize);
        const t = elapsed;
        const bx2 = fx + (tx - fx) * t;
        const by2 = fy + (ty - fy) * t - Math.sin(t * Math.PI) * R * 2;

        ctx.beginPath();
        ctx.arc(bx2, by2, Math.max(2 / scale, R * 0.12), 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
        ctx.strokeStyle = "#fde047";
        ctx.lineWidth   = 1 / scale;
        ctx.stroke();
      }
    }

    // ── Pass 9: unités terrestres ─────────────────────────────────────────────
    {
      const nowL = Date.now();
      for (const unit of (game.landUnits ?? [])) {
        if (unit.x < x0 - 1 || unit.x > x1 + 1 || unit.y < y0 - 1 || unit.y > y1 + 1) continue;
        const { x: cx, y: cy } = hexCenter(unit.x, unit.y, tileSize);
        const ownerColor = colorByPlayer.get(unit.playerId) ?? "#f2ca50";
        const bob = Math.sin(nowL / 600 + unit.x * 1.1 + unit.y * 0.9) * R * 0.06;
        const lw = Math.max(1, 1.5 / scale);

        ctx.save();
        ctx.translate(cx, cy + bob);

        if (unit.civilization === "steppe_horde") {
          // ── Cavalier (Horde des Steppes) ──
          // Ombre
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#060f28";
          ctx.beginPath();
          ctx.ellipse(0, R * 0.55, R * 0.65, R * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Corps du cheval (ellipse inclinée)
          ctx.beginPath();
          ctx.ellipse(R*0.05, R*0.15, R*0.52, R*0.22, Math.PI/10, 0, Math.PI*2);
          ctx.fillStyle = rgba(ownerColor, 0.85);
          ctx.fill();
          ctx.strokeStyle = rgba(ownerColor, 1);
          ctx.lineWidth = lw;
          ctx.stroke();

          // Tête du cheval
          ctx.beginPath();
          ctx.ellipse(R*0.52, -R*0.05, R*0.18, R*0.14, Math.PI/6, 0, Math.PI*2);
          ctx.fillStyle = rgba(ownerColor, 0.85);
          ctx.fill();
          ctx.stroke();

          // Crinière
          ctx.beginPath();
          ctx.moveTo(R*0.05, -R*0.05);
          ctx.quadraticCurveTo(R*0.25, -R*0.35, R*0.48, -R*0.16);
          ctx.strokeStyle = rgba(ownerColor, 1);
          ctx.lineWidth = lw * 2;
          ctx.stroke();

          // Jambes (4 traits)
          ctx.lineWidth = lw * 1.3;
          for (const [lx, ly, ex, ey] of [[-R*.3,R*.3,-R*.28,R*.58],[- R*.1,R*.35,-R*.06,R*.6],[R*.15,R*.33,R*.19,R*.58],[R*.35,R*.28,R*.42,R*.52]] as number[][]) {
            ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(ex,ey); ctx.stroke();
          }

          // Cavalier (corps)
          ctx.fillStyle = rgba(ownerColor, 0.9);
          ctx.strokeStyle = rgba(ownerColor, 1);
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.rect(-R*0.16, -R*0.55, R*0.3, R*0.38);
          ctx.fill(); ctx.stroke();

          // Tête du cavalier
          ctx.beginPath();
          ctx.arc(-R*0.01, -R*0.68, R*0.14, 0, Math.PI*2);
          ctx.fill(); ctx.stroke();

          // Lance
          ctx.beginPath();
          ctx.moveTo(R*0.12, -R*0.6);
          ctx.lineTo(R*0.55, -R*1.0);
          ctx.lineWidth = lw * 1.5;
          ctx.strokeStyle = rgba(ownerColor, 1);
          ctx.stroke();
          // Pointe
          ctx.beginPath();
          ctx.moveTo(R*0.55, -R*1.0);
          ctx.lineTo(R*0.45, -R*0.88);
          ctx.lineTo(R*0.62, -R*0.88);
          ctx.closePath();
          ctx.fillStyle = "#fde047";
          ctx.fill();

        } else {
          // ── Golem (Nains de Fer) ──
          const gc = "rgba(160,170,180,0.92)"; // gris métallique

          // Ombre
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#060f28";
          ctx.beginPath();
          ctx.ellipse(0, R*0.75, R*0.55, R*0.16, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Jambes
          ctx.fillStyle = gc;
          ctx.strokeStyle = rgba(ownerColor, 0.7);
          ctx.lineWidth = lw;
          ctx.fillRect(-R*0.35, R*0.32, R*0.28, R*0.42); ctx.strokeRect(-R*0.35,R*0.32,R*0.28,R*0.42);
          ctx.fillRect( R*0.07, R*0.32, R*0.28, R*0.42); ctx.strokeRect( R*0.07,R*0.32,R*0.28,R*0.42);

          // Corps
          ctx.fillStyle = gc;
          ctx.fillRect(-R*0.42, -R*0.2, R*0.84, R*0.54);
          ctx.strokeRect(-R*0.42,-R*0.2,R*0.84,R*0.54);

          // Détail corps (owner color stripe)
          ctx.fillStyle = rgba(ownerColor, 0.6);
          ctx.fillRect(-R*0.28, -R*0.08, R*0.56, R*0.1);

          // Bras
          ctx.fillStyle = gc;
          ctx.fillRect(-R*0.68, -R*0.18, R*0.24, R*0.4); ctx.strokeRect(-R*0.68,-R*0.18,R*0.24,R*0.4);
          ctx.fillRect( R*0.44, -R*0.18, R*0.24, R*0.4); ctx.strokeRect( R*0.44,-R*0.18,R*0.24,R*0.4);

          // Tête
          ctx.fillStyle = gc;
          ctx.fillRect(-R*0.32, -R*0.68, R*0.64, R*0.46);
          ctx.strokeRect(-R*0.32,-R*0.68,R*0.64,R*0.46);

          // Yeux rouges lumineux
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(-R*0.24, -R*0.56, R*0.16, R*0.12);
          ctx.fillRect( R*0.08, -R*0.56, R*0.16, R*0.12);
          ctx.save();
          ctx.shadowColor = "#ef4444"; ctx.shadowBlur = R * 0.8;
          ctx.fillRect(-R*0.24,-R*0.56,R*0.16,R*0.12);
          ctx.fillRect( R*0.08,-R*0.56,R*0.16,R*0.12);
          ctx.restore();

          // Glow owner
          ctx.save();
          ctx.shadowColor = ownerColor; ctx.shadowBlur = R * 1.2;
          ctx.strokeStyle = rgba(ownerColor, 0.6); ctx.lineWidth = lw;
          ctx.strokeRect(-R*0.42,-R*0.2,R*0.84,R*0.54);
          ctx.restore();
        }

        // HP bar
        if ((unit.civilization === "iron_dwarves" && unit.hp < 5) || (unit.civilization === "steppe_horde" && unit.hp < 3)) {
          const maxHp = unit.civilization === "iron_dwarves" ? 5 : 3;
          const barW = R * 1.1; const barH = R * 0.16;
          const barX = -barW/2; const barY = -R * 0.95;
          ctx.fillStyle = rgba("#111", 0.7); ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = unit.hp / maxHp > 0.5 ? "#22c55e" : "#ef4444";
          ctx.fillRect(barX, barY, barW * (unit.hp / maxHp), barH);
        }

        ctx.restore();
      }

      // Flash catapulte sur les cases bombardées
      for (const flash of (game.catapultFlashes ?? [])) {
        const elapsed = (nowL - flash.startedAt) / 2500;
        if (elapsed >= 1) continue;
        const alpha = (1 - elapsed) * 0.55;
        const { x: cx2, y: cy2 } = hexCenter(flash.center.x, flash.center.y, tileSize);
        // Cercle de souffle
        ctx.beginPath();
        ctx.arc(cx2, cy2, R * 3.5 * elapsed, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,165,0,${alpha * 0.4})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,220,50,${alpha})`;
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
        // Centre
        ctx.beginPath();
        ctx.arc(cx2, cy2, R * 0.6 * (1 - elapsed * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,100,0,${alpha})`;
        ctx.fill();
      }
    }

    // ── Pass 10: maritime animations ─────────────────────────────────────────
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
      ctx.fillText("🛶", cx, cy);
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
