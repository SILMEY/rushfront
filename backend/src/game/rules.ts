import { BuildingType, TileType, type Vec2 } from "./types.js";

export const MAP_WIDTH = 200;
export const MAP_HEIGHT = 200;
export const TURN_SECONDS = 10;
export const MAX_PLAYERS = 10;

export const PLAYER_COLORS = [
  "#60a5fa",
  "#f87171",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#4ade80",
  "#e879f9",
  "#f97316"
];

export function claimCost(tileType: TileType): number {
  switch (tileType) {
    case TileType.Plain:
      return 1;
    case TileType.Forest:
      return 2;
    case TileType.Quarry:
      return 2;
    default:
      return Infinity;
  }
}

export function buildCost(building: BuildingType): { wood: number; stone: number } {
  switch (building) {
    case BuildingType.FishingHut:
      return { wood: 5, stone: 0 };
    case BuildingType.Sawmill:
      return { wood: 5, stone: 0 };
    case BuildingType.Mine:
      return { wood: 5, stone: 0 };
    case BuildingType.Barracks:
      return { wood: 20, stone: 10 };
    case BuildingType.University:
      return { wood: 20, stone: 20 };
    case BuildingType.Base:
      return { wood: 0, stone: 0 };
    default:
      return { wood: 9999, stone: 9999 };
  }
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
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 }
  ];
}
