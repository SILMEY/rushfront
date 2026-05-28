import { MAP_HEIGHT, MAP_WIDTH } from "./rules.js";
import { TileType } from "./types.js";

type MapGenOptions = {
  width?: number;
  height?: number;
  lakeCount?: number;
  targetWaterPct?: number;
  forestPct?: number;
  quarryPct?: number;
  seed?: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function generateMap(options: MapGenOptions = {}) {
  const width = options.width ?? MAP_WIDTH;
  const height = options.height ?? MAP_HEIGHT;
  const lakeCount = options.lakeCount ?? 36;
  const targetWaterPct = options.targetWaterPct ?? 0.28;
  const forestPct = options.forestPct ?? 0.12;
  const quarryPct = options.quarryPct ?? 0.06;
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = mulberry32(seed);

  const types = new Uint8Array(width * height);
  types.fill(TileType.Plain);

  const waterTarget = Math.floor(width * height * clamp(targetWaterPct, 0.02, 0.5));
  let waterPlaced = 0;

  const isEdge = (x: number, y: number) => x < 5 || y < 5 || x >= width - 5 || y >= height - 5;

  const neighbors = (x: number, y: number) => [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ];

  // Organic lakes: grow from random centers using a biased frontier.
  const frontier: Array<{ x: number; y: number }> = [];
  const bigLakeCount = 9;
  const totalLakes = lakeCount + bigLakeCount;
  for (let i = 0; i < totalLakes; i++) {
    let cx = Math.floor(rand() * width);
    let cy = Math.floor(rand() * height);
    let guard = 0;
    while (isEdge(cx, cy) && guard++ < 50) {
      cx = Math.floor(rand() * width);
      cy = Math.floor(rand() * height);
    }
    frontier.push({ x: cx, y: cy });
    // Big lakes get extra seed pressure to form larger connected bodies.
    if (i < bigLakeCount) {
      const extra = 120 + Math.floor(rand() * 120);
      for (let k = 0; k < extra; k++) frontier.push({ x: cx, y: cy });
    }
  }

  while (frontier.length > 0 && waterPlaced < waterTarget) {
    const i = Math.floor(rand() * frontier.length);
    const picked = frontier.splice(i, 1)[0]!;
    const { x, y } = picked;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    if (types[index] === TileType.Water) continue;

    types[index] = TileType.Water;
    waterPlaced++;

    for (const n of neighbors(x, y)) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue;
      const nIdx = n.y * width + n.x;
      if (types[nIdx] === TileType.Water) continue;
      let adjacentWater = 0;
      for (const nn of neighbors(n.x, n.y)) {
        if (nn.x < 0 || nn.y < 0 || nn.x >= width || nn.y >= height) continue;
        if (types[nn.y * width + nn.x] === TileType.Water) adjacentWater++;
      }
      const p = Math.min(0.92, 0.28 + adjacentWater * 0.2);
      if (rand() < p) frontier.push(n);
    }
  }

  // Smoothing pass to reduce 1-tile noise.
  for (let pass = 0; pass < 3; pass++) {
    const copy = types.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        const self = copy[index];
        let waterNeighbors = 0;
        for (const n of neighbors(x, y)) {
          if (copy[n.y * width + n.x] === TileType.Water) waterNeighbors++;
        }
        if (self !== TileType.Water && waterNeighbors >= 3 && rand() < 0.7) types[index] = TileType.Water;
        if (self === TileType.Water && waterNeighbors <= 0 && rand() < 0.8) types[index] = TileType.Plain;
      }
    }
  }

  function placeClusters(tileType: TileType, targetPct: number) {
    const target = Math.floor(width * height * clamp(targetPct, 0, 0.4));
    let placed = 0;
    const tries = target * 20;
    for (let t = 0; t < tries && placed < target; t++) {
      const cx = Math.floor(rand() * width);
      const cy = Math.floor(rand() * height);
      const radius = 2 + Math.floor(rand() * 6);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (placed >= target) break;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > radius * radius) continue;
          const p = 0.85 - d2 / (radius * radius + 1);
          if (rand() > p) continue;
          const index = y * width + x;
          if (types[index] === TileType.Water) continue;
          if (types[index] !== TileType.Plain) continue;
          types[index] = tileType;
          placed++;
        }
      }
    }
  }

  placeClusters(TileType.Forest, forestPct);
  placeClusters(TileType.Quarry, quarryPct);

  return { width, height, seed, types };
}
