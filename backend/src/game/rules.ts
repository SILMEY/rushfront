import { BuildingType, TileType, type Vec2 } from "./types.js";

export const MAP_WIDTH = 93;
export const MAP_HEIGHT = 70;
export const TURN_MS = 100; // 100ms per turn — near-instantaneous
export const TURN_SECONDS = TURN_MS / 1000;
// Scale factor applied to all per-turn production so real-time economy stays the same pace
// as when turns were 10s long. (0.1s / 10s = 0.01)
export const PROD_SCALE = TURN_MS / 10_000;
export const MAX_PLAYERS = 10;

// Lobby/player colors (avoid terrain-like greens/blues/greys).
export const PLAYER_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#a855f7", // purple
  "#fde047", // light yellow
  "#f97316", // orange
  "#ffffff", // white
  "#22c55e", // green (allowed as player color, distinct from dark forest)
  "#f472b6", // pink
  "#06b6d4", // cyan
  "#e11d48" // rose
];

export function claimCost(tileType: TileType): number {
  switch (tileType) {
    case TileType.Plain:
      return 1;
    default:
      return Infinity;
  }
}

export function buildCost(building: BuildingType, existingCount = 0): { wood: number; stone: number } {
  switch (building) {
    case BuildingType.FishingHut: // Port
      return { wood: 10, stone: 10 }; // confirme le coût côté client
    case BuildingType.Sawmill:
      return { wood: existingCount === 0 ? 5 : 10, stone: 0 };
    case BuildingType.Mine:
      return { wood: 10, stone: 0 };
    case BuildingType.Barracks:
      return { wood: 20, stone: 10 };
    case BuildingType.University:
      return { wood: 20, stone: 20 };
    case BuildingType.City:
      return { wood: 40, stone: 80 };
    case BuildingType.Wonder:
      return { wood: 150, stone: 300 };
    case BuildingType.Catapult:
      return { wood: 30, stone: 20 };
    case BuildingType.Base:
    case BuildingType.Bridge:
      return { wood: 0, stone: 0 };
    default:
      return { wood: 9999, stone: 9999 };
  }
}

export const GALLEON_COST = { wood: 25, stone: 15 };
export const GALLEON_HP   = 3;
export const GALLEON_MAX_PER_PORT = 2;
export const GALLEON_ATTACK_RANGE = 3.5;

export const LAND_UNIT_COST = { wood: 15, stone: 10 };
export const LAND_UNIT_MAX_PER_BARRACKS = 2;
export const CATAPULT_FIRE_INTERVAL_MS = 60_000;
export const CATAPULT_RANGE = 15;
export const CURSE_FOREST_COOLDOWN_MS = 60_000;

export function landUnitHP(civilization: string): number {
  return civilization === "iron_dwarves" ? 5 : 3;
}
export function landUnitDamage(civilization: string): number {
  return civilization === "iron_dwarves" ? 3 : 2;
}

export function inBounds(pos: Vec2, width: number, height: number) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < width && pos.y < height;
}

export function idx(pos: Vec2, width: number) {
  return pos.y * width + pos.x;
}

export function manhattan(a: Vec2, b: Vec2) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function withinRadius(a: Vec2, b: Vec2, radius: number) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= radius * radius;
}

export function orthogonalNeighbors(pos: Vec2): Vec2[] {
  const { x: col, y: row } = pos;
  const even = row % 2 === 0;
  return even
    ? [
        { x: col,     y: row - 1 },
        { x: col + 1, y: row     },
        { x: col,     y: row + 1 },
        { x: col - 1, y: row + 1 },
        { x: col - 1, y: row     },
        { x: col - 1, y: row - 1 },
      ]
    : [
        { x: col + 1, y: row - 1 },
        { x: col + 1, y: row     },
        { x: col + 1, y: row + 1 },
        { x: col,     y: row + 1 },
        { x: col - 1, y: row     },
        { x: col,     y: row - 1 },
      ];
}
