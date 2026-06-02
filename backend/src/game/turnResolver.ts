import { BuildingType, TileType, type BuildIntent, type Vec2 } from "./types.js";
import { PROD_SCALE, buildCost, claimCost, idx, inBounds, orthogonalNeighbors, withinRadius } from "./rules.js";

// Stochastic rounding: preserves expected value at any PROD_SCALE.
// E[pGain(n)] = n * PROD_SCALE regardless of how small PROD_SCALE is.
function pGain(n: number): number {
  if (n <= 0) return 0;
  const expected = n * PROD_SCALE;
  const base = Math.floor(expected);
  return base + (Math.random() < expected - base ? 1 : 0);
}

type RuntimePlayer = {
  id: string;
  civilization?: string;
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
  attacks: Map<string, Map<number, number>>;
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
    if (tileType !== TileType.Plain) continue;

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

    // Civilization claim cost modifiers
    const pos = tilePos(tileIndex, width);
    const civ = player.civilization;
    if (civ === "steppe_horde") {
      cost = 0; // Horde claims are always free
    } else if (civ === "sylvan_elves" && adjacentCountOfType(tileTypes, pos, width, height, TileType.Forest) > 0) {
      cost = 0; // Elfes claim for free when adjacent to a forest
    }

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
  // Combat resolution: attacker sends N soldiers; defender has D soldiers.
  // Both lose min(N, D). If N > D, attacker captures the tile.
  // Reserved soldiers were already subtracted when queuing the attack; surviving attackers return to the pool.
  const tileAttackers = new Map<number, Array<{ pid: string; amount: number }>>(); // tileIndex -> attackers
  for (const [pid, map] of input.attacks) {
    for (const [tileIndex, amount] of map.entries()) {
      const list = tileAttackers.get(tileIndex) ?? [];
      list.push({ pid, amount });
      tileAttackers.set(tileIndex, list);
    }
  }

  for (const [tileIndex, attackers] of tileAttackers) {
    const refundAll = () => {
      for (const { pid, amount } of attackers) {
        const attacker = players.find((p) => p.id === pid);
        if (!attacker) continue;
        const N = Math.max(0, Math.floor(amount));
        attacker.resources.soldiers += N;
      }
    };

    const contestedUntil = tileContestedUntil[tileIndex];
    if (contestedUntil != null && contestedUntil >= currentTurn) {
      refundAll();
      continue;
    }

    const owner = tileOwners[tileIndex];
    if (!owner) {
      refundAll();
      continue;
    }

    const tileType = tileTypes[tileIndex] as TileType;
    if (tileType !== TileType.Plain) {
      refundAll();
      continue;
    }

    if (attackers.length !== 1) {
      refundAll();
      tileContestedUntil[tileIndex] = currentTurn + 1;
      continue;
    }

    const { pid, amount } = attackers[0]!;
    const attacker = players.find((p) => p.id === pid);
    if (!attacker) continue;
    if (owner === pid) {
      attacker.resources.soldiers += Math.max(0, Math.floor(amount));
      continue;
    }

    const defender = players.find((p) => p.id === owner);
    if (!defender) {
      attacker.resources.soldiers += Math.max(0, Math.floor(amount));
      continue;
    }

    const N = Math.max(0, Math.floor(amount));
    if (N <= 0) continue;

    const D = Math.max(0, defender.resources.soldiers);

    // Civilization combat multipliers
    const atkMult = attacker.civilization === "steppe_horde" ? 1.5
                  : attacker.civilization === "iron_dwarves"  ? 0.75 : 1.0;
    const defMult = defender.civilization === "iron_dwarves"  ? 1.5
                  : defender.civilization === "steppe_horde"  ? 0.75 : 1.0;

    const N_eff = Math.round(N * atkMult); // effective attack power
    const D_eff = Math.round(D * defMult); // effective defense power

    const defenderLoss = Math.min(N_eff, D);   // bounded by actual troops
    const attackerLoss  = Math.min(D_eff, N);

    defender.resources.soldiers -= defenderLoss;
    const attackerSurvivors = N - attackerLoss;
    if (attackerSurvivors > 0) attacker.resources.soldiers += attackerSurvivors;

    if (N_eff > D_eff) {
      tileOwners[tileIndex] = pid;
      tileContestedUntil[tileIndex] = null;
    }
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
  // All raw values are the same as the original 10s-turn design;
  // pGain() scales them down so the real-time economy rate is unchanged.
  for (const player of players) {
    const ownedTiles = countOwned(tileOwners, player.id);
    const techs = new Set((player as any).techs as string[] | undefined);

    let fishingHuts = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] === player.id && tileBuildings[i] === BuildingType.FishingHut) fishingHuts++;
    }

    const baseRecruits =
      Math.floor(player.resources.villagers / 10) +
      1 + Math.floor(ownedTiles / 12) + Math.floor(fishingHuts / 2) +
      (techs.has("mil_training") ? 1 : 0);
    const rawRecruits = player.civilization === "steppe_horde"
      ? Math.round(baseRecruits * 1.5) : baseRecruits;
    const recruits = pGain(rawRecruits);

    const desiredPctRaw = (player as any).desiredSoldierPct;
    const desiredPct =
      typeof desiredPctRaw === "number" && Number.isFinite(desiredPctRaw) ? Math.max(0, Math.min(100, desiredPctRaw)) : 0;

    const currentTotal = player.resources.villagers + player.resources.soldiers;
    const nextTotal = currentTotal + recruits;
    const targetSoldiers = Math.max(0, Math.min(nextTotal, Math.round((desiredPct / 100) * nextTotal)));
    const deltaSoldiers = targetSoldiers - player.resources.soldiers;
    const addSoldiers = Math.max(0, Math.min(recruits, deltaSoldiers));
    const addVillagers = recruits - addSoldiers;

    player.resources.soldiers += addSoldiers;
    player.resources.villagers += addVillagers;

    const passiveWoodBase  = Math.floor(player.resources.villagers / 12);
    const passiveStoneBase = Math.floor(player.resources.villagers / 24);
    player.resources.wood  += pGain(player.civilization === "sylvan_elves" ? passiveWoodBase  * 2 : passiveWoodBase);
    player.resources.stone += pGain(player.civilization === "iron_dwarves" ? passiveStoneBase * 2 : passiveStoneBase);

    let rawWood = 0;
    let sawmills = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] !== player.id) continue;
      if (tileBuildings[i] !== BuildingType.Sawmill) continue;
      sawmills++;
      const pos = tilePos(i, width);
      rawWood += Math.min(3, adjacentCountOfType(tileTypes, pos, width, height, TileType.Forest));
    }
    if (techs.has("eco_tools")) rawWood += sawmills * 1;
    if (player.civilization === "sylvan_elves") rawWood *= 2;
    player.resources.wood += pGain(rawWood);

    let rawStone = 0;
    let mines = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] !== player.id) continue;
      if (tileBuildings[i] !== BuildingType.Mine) continue;
      mines++;
      const pos = tilePos(i, width);
      rawStone += Math.min(3, adjacentCountOfType(tileTypes, pos, width, height, TileType.Quarry));
    }
    if (techs.has("eco_tools")) rawStone += mines * 1;
    if (player.civilization === "iron_dwarves") rawStone *= 2;
    player.resources.stone += pGain(rawStone);

    // Empire d'Aurélien: passive territorial income (+1 wood +1 stone per 10 owned tiles)
    if (player.civilization === "aurelian_empire") {
      const territoryBonus = Math.floor(ownedTiles / 10);
      player.resources.wood  += pGain(territoryBonus);
      player.resources.stone += pGain(territoryBonus);
    }
  }
}
