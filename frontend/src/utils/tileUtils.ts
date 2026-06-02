import { BuildingType, TileType, type GameStateSnapshot } from "../types/game";

export function tileIndex(x: number, y: number, width: number) {
  return y * width + x;
}

export function tileAt(state: GameStateSnapshot, x: number, y: number) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  const i = tileIndex(x, y, state.width);
  return {
    type: state.tiles.types[i] as TileType,
    owner: state.tiles.owners[i],
    building: state.tiles.buildings[i] as BuildingType | null,
    contested: false
  };
}

export function isWater(t: TileType) {
  return t === TileType.Water;
}

