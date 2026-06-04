import type { GameStateSnapshot, Vec2 } from "../types/game";
import { TileType } from "../types/game";

function hexNeighbors(col: number, row: number): Vec2[] {
  return row % 2 === 0
    ? [{x:col,y:row-1},{x:col+1,y:row},{x:col,y:row+1},{x:col-1,y:row+1},{x:col-1,y:row},{x:col-1,y:row-1}]
    : [{x:col+1,y:row-1},{x:col+1,y:row},{x:col+1,y:row+1},{x:col,y:row+1},{x:col-1,y:row},{x:col,y:row-1}];
}

function key(p: Vec2) { return `${p.x},${p.y}`; }

function tileTypeAt(state: GameStateSnapshot, p: Vec2): TileType {
  return state.tiles.types[p.y * state.width + p.x] as TileType;
}

function inBounds(state: GameStateSnapshot, p: Vec2): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < state.width && p.y < state.height;
}

// BFS from portPos through water tiles to targetPos (which must be adjacent to water).
// Returns full path [portPos, ...waterTiles, targetPos] or null if unreachable.
export function findWaterPath(
  state: GameStateSnapshot,
  portPos: Vec2,
  targetPos: Vec2
): Vec2[] | null {
  // Water tiles adjacent to target are goal states
  const goalKeys = new Set<string>(
    hexNeighbors(targetPos.x, targetPos.y)
      .filter(n => inBounds(state, n) && tileTypeAt(state, n) === TileType.Water)
      .map(key)
  );
  if (goalKeys.size === 0) return null;

  // Seed queue from water tiles adjacent to port
  const starts = hexNeighbors(portPos.x, portPos.y)
    .filter(n => inBounds(state, n) && tileTypeAt(state, n) === TileType.Water);
  if (starts.length === 0) return null;

  // BFS with parent map (no path copying)
  const parent = new Map<string, Vec2 | null>();
  const queue: Vec2[] = [];

  for (const s of starts) {
    const k = key(s);
    if (!parent.has(k)) {
      parent.set(k, portPos);
      queue.push(s);
    }
  }

  let found: Vec2 | null = null;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const k = key(cur);
    if (goalKeys.has(k)) { found = cur; break; }

    for (const nb of hexNeighbors(cur.x, cur.y)) {
      const nk = key(nb);
      if (parent.has(nk) || !inBounds(state, nb)) continue;
      if (tileTypeAt(state, nb) !== TileType.Water) continue;
      parent.set(nk, cur);
      queue.push(nb);
    }
  }

  if (!found) return null;

  // Reconstruct path
  const path: Vec2[] = [targetPos];
  let cur: Vec2 | null = found;
  while (cur && key(cur) !== key(portPos)) {
    path.unshift(cur);
    cur = parent.get(key(cur)) ?? null;
  }
  path.unshift(portPos);
  return path;
}
