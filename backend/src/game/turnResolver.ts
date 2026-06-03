import { BuildingType, TileType } from "./types.js";
import { PROD_SCALE } from "./rules.js";

// Stochastic rounding: E[pGain(n)] = n * PROD_SCALE
function pGain(n: number): number {
  if (n <= 0) return 0;
  const expected = n * PROD_SCALE;
  const base = Math.floor(expected);
  return base + (Math.random() < expected - base ? 1 : 0);
}

type ProductionPlayer = {
  id: string;
  civilization?: string;
  resources: { villagers: number; soldiers: number; wood: number; stone: number };
};

function tilePos(i: number, width: number) {
  return { x: i % width, y: Math.floor(i / width) };
}

function adjacentForestCount(tileTypes: Uint8Array, x: number, y: number, width: number, height: number) {
  let n = 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (tileTypes[ny * width + nx] === TileType.Forest) n++;
  }
  return n;
}

function adjacentQuarryCount(tileTypes: Uint8Array, x: number, y: number, width: number, height: number) {
  let n = 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (tileTypes[ny * width + nx] === TileType.Quarry) n++;
  }
  return n;
}

export function applyProduction(input: {
  players: ProductionPlayer[];
  tileOwners: Array<string | null>;
  tileBuildings: Array<number | null>;
  tileTypes: Uint8Array;
  width: number;
  height: number;
}) {
  const { players, tileOwners, tileBuildings, tileTypes, width, height } = input;

  for (const player of players) {
    const techs = new Set((player as any).techs as string[] | undefined);

    // Count owned tiles and cities
    let ownedTiles = 0;
    let cityCount = 0;
    for (let i = 0; i < tileOwners.length; i++) {
      if (tileOwners[i] !== player.id) continue;
      ownedTiles++;
      if (tileBuildings[i] === BuildingType.City) cityCount++;
    }

    // Habitants: max = 5 par case + 500 par Cité
    const maxPop = ownedTiles * 5 + cityCount * 500;
    const currentPop = player.resources.villagers + player.resources.soldiers;

    if (currentPop < maxPop) {
      const ratePerTick = Math.sqrt(ownedTiles) * 0.07;
      const accumulated = ((player as any).habitantFraction ?? 0) + ratePerTick;
      const floored = Math.floor(accumulated);
      const newHabitants = Math.min(floored, maxPop - currentPop);
      (player as any).habitantFraction = currentPop + newHabitants >= maxPop ? 0 : accumulated - floored;

      const desiredPct = (() => {
        const v = (player as any).desiredSoldierPct;
        return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
      })();
      const total = player.resources.villagers + player.resources.soldiers + newHabitants;
      const targetSoldiers = Math.max(0, Math.min(total, Math.round((desiredPct / 100) * total)));
      const addSoldiers = Math.max(0, Math.min(newHabitants, targetSoldiers - player.resources.soldiers));
      player.resources.soldiers += addSoldiers;
      player.resources.villagers += newHabitants - addSoldiers;
    } else {
      (player as any).habitantFraction = 0;
    }

    // Passive wood/stone from villagers
    const passiveWood  = Math.floor(player.resources.villagers / 12);
    const passiveStone = Math.floor(player.resources.villagers / 24);
    player.resources.wood  += pGain(player.civilization === "sylvan_elves" ? passiveWood  * 2 : passiveWood);
    player.resources.stone += pGain(player.civilization === "iron_dwarves" ? passiveStone * 2 : passiveStone);

    // Sawmills
    let rawWood = 0, sawmills = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] !== player.id || tileBuildings[i] !== BuildingType.Sawmill) continue;
      sawmills++;
      const { x, y } = tilePos(i, width);
      rawWood += Math.min(15, adjacentForestCount(tileTypes, x, y, width, height) * 5);
    }
    if (techs.has("eco_tools")) rawWood += sawmills * 5;
    if (player.civilization === "sylvan_elves") rawWood *= 2;
    player.resources.wood += pGain(rawWood);

    // Mines
    let rawStone = 0, mines = 0;
    for (let i = 0; i < tileBuildings.length; i++) {
      if (tileOwners[i] !== player.id || tileBuildings[i] !== BuildingType.Mine) continue;
      mines++;
      const { x, y } = tilePos(i, width);
      rawStone += Math.min(15, adjacentQuarryCount(tileTypes, x, y, width, height) * 5);
    }
    if (techs.has("eco_tools")) rawStone += mines * 5;
    if (player.civilization === "iron_dwarves") rawStone *= 2;
    player.resources.stone += pGain(rawStone);

    // Conversion graduelle villageois ↔ soldats vers desiredSoldierPct
    // Courbe : 1er instantané, puis 2s/unité en accélérant jusqu'à 5/s
    {
      const desiredPct = (() => {
        const v = (player as any).desiredSoldierPct;
        return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
      })();
      const totalPop = player.resources.villagers + player.resources.soldiers;
      const targetSol = Math.max(0, Math.min(totalPop, Math.round((desiredPct / 100) * totalPop)));
      const delta = targetSol - player.resources.soldiers;

      if (delta !== 0) {
        const convIdx: number = (player as any).conversionIndex ?? 0;
        let toConvert: number;

        if (convIdx === 0) {
          toConvert = 1;
          (player as any).conversionIndex  = 1;
          (player as any).conversionCredit = 0;
        } else {
          // rate démarre à 0.5/s (2s/unité) et monte de 0.1/s par unité convertie, cap 5/s
          const rate = Math.min(5, 0.5 + (convIdx - 1) * 0.1);
          const credit = ((player as any).conversionCredit ?? 0) + rate;
          toConvert = Math.floor(credit);
          (player as any).conversionCredit = credit - toConvert;
          if (toConvert > 0) (player as any).conversionIndex = convIdx + toConvert;
        }

        toConvert = Math.min(toConvert, Math.abs(delta));

        if (delta > 0 && toConvert > 0) {
          const c = Math.min(toConvert, player.resources.villagers);
          player.resources.soldiers  += c;
          player.resources.villagers -= c;
        } else if (delta < 0 && toConvert > 0) {
          const c = Math.min(toConvert, player.resources.soldiers);
          player.resources.villagers += c;
          player.resources.soldiers  -= c;
        }
      } else {
        (player as any).conversionIndex  = 0;
        (player as any).conversionCredit = 0;
      }
    }

    // Bateaux de pêche (passif bois par bateau)
    const fishingBoats = (player as any).fishingBoats ?? 0;
    if (fishingBoats > 0) player.resources.wood += pGain(fishingBoats * 3);

    // Empire d'Aurélien territorial bonus
    if (player.civilization === "aurelian_empire") {
      const bonus = Math.floor(ownedTiles / 10);
      player.resources.wood  += pGain(bonus);
      player.resources.stone += pGain(bonus);
    }
  }
}
