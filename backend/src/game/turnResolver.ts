import { BuildingType, TileType, type BuildIntent, type Vec2 } from "./types.js";
import { buildCost, claimCost, idx, inBounds, orthogonalNeighbors, withinRadius } from "./rules.js";

type RuntimePlayer = {
  id: string;
  resources: { villagers: number; soldiers: number; wood: number; stone: number };
};

type TurnInput = {
  gameId: string;
  width: number;
  height: number;
  currentTurn: number;
  players: RuntimePlayer[];
  tileTypes: Uint8Array;
  tileOwners: Array<string | null>;
  tileBuildings: Array<number | null>;
  tileContestedUntil: Array<number | null>;
  claims: Map<string, Set<number>>;
  attacks: Map<string, Set<number>>;
  pendingBuilds: Map<string, BuildIntent[]>;
};

function tilePos(tileIndex: number, width: number) {
  return { x: tileIndex % width, y: Math.floor(tileIndex / width) };
}

function countOwned(tileOwners: Array<string | null>, playerId: string) {
  let count = 0;
  for (const o of tileOwners) if (o === playerId) count++;
  return count;
}

function getBarracks(tileOwners: Array<string | null>, tileBuildings: Array<number | null>, playerId: string, width: number) {
  const positions: Vec2[] = [];
  for (let i = 0; i < tileBuildings.length; i++) {
    if (tileOwners[i] !== playerId) continue;
    if (tileBuildings[i] === BuildingType.Barracks) positions.push(tilePos(i, width));
  }
  return positions;
}

function inBarracksRange(barracks: Vec2[], pos: Vec2) {
  return barracks.some((b) => withinRadius(b, pos, 10));
}

function adjacentCountOfType(tileTypes: Uint8Array, pos: Vec2, width: number, height: number, type: TileType) {
  let count = 0;
  for (const n of orthogonalNeighbors(pos)) {
    if (!inBounds(n, width, height)) continue;
    if (tileTypes[idx(n, width)] === type) count++;
  }
  return count;
}

export function resolveTurn(input: TurnInput) {
  const { width, height, currentTurn, players, tileTypes, tileOwners, tileBuildings, tileContestedUntil } = input;

  const tileClaimers = new Map<number, string[]>(); // tileIndex -> playerIds
  for (const [pid, set] of input.claims) {
    for (const tileIndex of set) {
      const list = tileClaimers.get(tileIndex) ?? [];
      list.push(pid);
      tileClaimers.set(tileIndex, list);
    }
  }

  // Local expansion: each barracks gives +3 local points per turn, usable within radius 10.
  // Design choice: for claims in range, spend local points first, then global soldiers.
  const localPoints = new Map<string, number>();
  const barracksByPlayer = new Map<string, Vec2[]>();
  for (const p of players) {
    const barracks = getBarracks(tileOwners, tileBuildings, p.id, width);
    barracksByPlayer.set(p.id, barracks);
    localPoints.set(p.id, barracks.length * 3);
  }

  for (const [tileIndex, claimers] of tileClaimers) {
    const contestedUntil = tileContestedUntil[tileIndex];
    if (contestedUntil != null && contestedUntil >= currentTurn) continue;
    if (tileOwners[tileIndex]) continue;

    const tileType = tileTypes[tileIndex] as TileType;
    if (tileType === TileType.Water) continue;

    if (claimers.length !== 1) {
      tileContestedUntil[tileIndex] = currentTurn + 1;
      continue;
    }

    const pid = claimers[0]!;
    const player = players.find((p) => p.id === pid);
    if (!player) continue;

    let cost = claimCost(tileType);
    if (!Number.isFinite(cost)) continue;

    const techs = new Set((player as any).techs as string[] | undefined);
    if (techs.has("logistics")) cost = Math.max(1, cost - 1);

    const pos = tilePos(tileIndex, width);
    const barracks = barracksByPlayer.get(pid) ?? [];
    const canLocal = inBarracksRange(barracks, pos);
    let local = localPoints.get(pid) ?? 0;

    if (canLocal && local > 0) {
      const spendLocal = Math.min(cost, local);
      local -= spendLocal;
      localPoints.set(pid, local);
      const remaining = cost - spendLocal;
      if (remaining > 0) {
        if (player.resources.soldiers < remaining) continue;
        player.resources.soldiers -= remaining;
      }
    } else {
      if (player.resources.soldiers < cost) continue;
      player.resources.soldiers -= cost;
    }

    tileOwners[tileIndex] = pid;
    tileContestedUntil[tileIndex] = null;
  }

  // Claims are per-turn intents: everything not validated is cleared.
  input.claims.clear();

  // Attacks: capture enemy tiles for a fixed soldier cost.
  const ATTACK_COST = 10;
  const tileAttackers = new Map<number, string[]>(); // tileIndex -> playerIds
  for (const [pid, set] of input.attacks) {
    for (const tileIndex of set) {
      const list = tileAttackers.get(tileIndex) ?? [];
      list.push(pid);
      tileAttackers.set(tileIndex, list);
    }
  }

  for (const [tileIndex, attackers] of tileAttackers) {
    const contestedUntil = tileContestedUntil[tileIndex];
    if (contestedUntil != null && contestedUntil >= currentTurn) continue;
    const owner = tileOwners[tileIndex];
    if (!owner) continue; // only enemy-owned tiles can be attacked

    const tileType = tileTypes[tileIndex] as TileType;
    if (tileType === TileType.Water) continue;

    if (attackers.length !== 1) {
      tileContestedUntil[tileIndex] = currentTurn + 1;
      continue;
    }

    const pid = attackers[0]!;
    const player = players.find((p) => p.id === pid);
    if (!player) continue;
    if (owner === pid) continue;

    if (player.resources.soldiers < ATTACK_COST) continue;

    player.resources.soldiers -= ATTACK_COST;
    tileOwners[tileIndex] = pid;
    tileContestedUntil[tileIndex] = null;
  }

  input.attacks.clear();

  // Builds are per-turn intents: validated at resolution, instantaneous placement.
  for (const [pid, builds] of input.pendingBuilds) {
    const player = players.find((p) => p.id === pid);
    if (!player) continue;

    for (const intent of builds) {
      const pos = { x: intent.x, y: intent.y };
      if (!inBounds(pos, width, height)) continue;
      const tileIndex = idx(pos, width);
      if (tileOwners[tileIndex] !== pid) continue;
      if (tileBuildings[tileIndex] != null) continue;
      if (tileTypes[tileIndex] === TileType.Water) continue;

      if (intent.building === BuildingType.FishingHut) {
        if (adjacentCountOfType(tileTypes, pos, width, height, TileType.Water) < 1) continue;
      }
      if (intent.building === BuildingType.Sawmill) {
        if (adjacentCountOfType(tileTypes, pos, width, height, TileType.Forest) < 1) continue;
      }
      if (intent.building === BuildingType.Mine) {
        if (adjacentCountOfType(tileTypes, pos, width, height, TileType.Quarry) < 1) continue;
      }
      tileBuildings[tileIndex] = intent.building;
    }
  }
  input.pendingBuilds.clear();

  // Production (applies at resolution, usable next turn).
  for (const player of players) {
    const ownedTiles = countOwned(tileOwners, player.id);
    const techs = new Set((player as any).techs as string[] | undefined);

    let fishingHuts = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] === player.id && tileBuildings[i] === BuildingType.FishingHut) fishingHuts++;
    }

    // Soldiers gain is intentionally slow (strategic pacing).
    const recruitFromVillagers = Math.floor(player.resources.villagers / 10);
    const recruitFromTerritory = 1 + Math.floor(ownedTiles / 12) + Math.floor(fishingHuts / 2);
    player.resources.soldiers += recruitFromVillagers + recruitFromTerritory + (techs.has("mil_training") ? 1 : 0);

    // Passive economy from villagers (small baseline so the split matters even early-game).
    player.resources.wood += Math.floor(player.resources.villagers / 12);
    player.resources.stone += Math.floor(player.resources.villagers / 24);

    let woodGain = 0;
    let sawmills = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] !== player.id) continue;
      if (tileBuildings[i] !== BuildingType.Sawmill) continue;
      sawmills++;
      const pos = tilePos(i, width);
      woodGain += Math.min(3, adjacentCountOfType(tileTypes, pos, width, height, TileType.Forest));
    }
    if (techs.has("eco_tools")) woodGain += sawmills * 1;
    player.resources.wood += woodGain;

    let stoneGain = 0;
    let mines = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] !== player.id) continue;
      if (tileBuildings[i] !== BuildingType.Mine) continue;
      mines++;
      const pos = tilePos(i, width);
      stoneGain += Math.min(3, adjacentCountOfType(tileTypes, pos, width, height, TileType.Quarry));
    }
    if (techs.has("eco_tools")) stoneGain += mines * 1;
    player.resources.stone += stoneGain;
  }
}
