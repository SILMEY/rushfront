import type { GameInstance } from "./GameInstance.js";
import { BuildingType, TileType, type CivilizationId, type Vec2 } from "./types.js";
import { idx, inBounds, orthogonalNeighbors } from "./rules.js";

const TICK_BASE_MS = 2000;
const TICK_JITTER_MS = 1000;

export class BotAI {
  private instance: GameInstance;
  readonly userId: string;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(instance: GameInstance, userId: string) {
    this.instance = instance;
    this.userId = userId;
  }

  start() {
    this.scheduleTick();
  }

  stop() {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  place() {
    const { instance, userId } = this;
    if (instance.status !== "PLACING") return;
    const player = instance.getPlayerByUserId(userId);
    if (!player || player.hasChosenStart) return;

    const { tileTypes, tileOwners, width, height, players } = instance;
    const MAX_ATTEMPTS = 300;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      if ((tileTypes[y * width + x] as TileType) !== TileType.Plain) continue;
      if (tileOwners[y * width + x]) continue;

      let tooClose = false;
      for (const p of players) {
        if (!p.basePosition) continue;
        if (Math.abs(p.basePosition.x - x) + Math.abs(p.basePosition.y - y) < 12) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      try {
        instance.chooseStart(userId, { x, y });
        return;
      } catch {
        continue;
      }
    }
  }

  private scheduleTick() {
    if (this.stopped) return;
    const delay = TICK_BASE_MS + Math.random() * TICK_JITTER_MS;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.stopped) {
        this.tick();
        this.scheduleTick();
      }
    }, delay);
  }

  private tick() {
    const { instance, userId } = this;
    const player = instance.getPlayerByUserId(userId);
    if (!player || player.eliminated) { this.stop(); return; }
    if (instance.status !== "ACTIVE") return;

    const myTiles = instance.getTilesOf(player.id);
    if (myTiles.size === 0) return;

    const civ = player.civilization as CivilizationId;
    const { resources } = player;
    const hasBarracks = instance.hasBuilding(player.id, BuildingType.Barracks);
    const sawmillCount = instance.buildingCount(player.id, BuildingType.Sawmill);
    const mineCount = instance.buildingCount(player.id, BuildingType.Mine);

    // steppe_horde : caserne en priorité absolue
    if (civ === "steppe_horde" && !hasBarracks && resources.wood >= 20 && resources.stone >= 10) {
      if (this.tryBuild(BuildingType.Barracks, myTiles)) return;
    }

    // Bâtiments de production (plafonnés selon la taille du territoire)
    const maxSawmills = Math.floor(myTiles.size / 15) + 1;
    const maxMines    = Math.floor(myTiles.size / 20) + 1;

    if (resources.wood >= 5 && sawmillCount < maxSawmills) {
      if (this.tryBuild(BuildingType.Sawmill, myTiles)) return;
    }
    if (resources.wood >= 10 && mineCount < maxMines) {
      if (this.tryBuild(BuildingType.Mine, myTiles)) return;
    }

    // Caserne (civs non-steppe ou steppe qui n'a pas pu construire ci-dessus)
    if (!hasBarracks && resources.wood >= 20 && resources.stone >= 10) {
      if (this.tryBuild(BuildingType.Barracks, myTiles)) return;
    }

    // Ajuster le pourcentage de soldats
    player.desiredSoldierPct = this.targetSoldierPct(civ, myTiles.size);

    // Attaquer si possible
    const soldierThreshold = civ === "steppe_horde" ? 3 : civ === "iron_dwarves" ? 15 : 8;
    if (hasBarracks && resources.soldiers >= soldierThreshold) {
      if (this.tryAttack(player.id, myTiles)) return;
    }

    // Expansion territoriale
    this.tryExpand(player.id, myTiles);
  }

  private targetSoldierPct(civ: CivilizationId, tileCount: number): number {
    let base = 25;
    if (tileCount > 80)  base = 40;
    if (tileCount > 200) base = 55;

    switch (civ) {
      case "steppe_horde":    return Math.min(75, base + 25);
      case "iron_dwarves":    return Math.min(60, base + 10);
      case "sylvan_elves":    return base;
      case "aurelian_empire": return Math.max(10, base - 15);
    }
  }

  private tryBuild(building: BuildingType, myTiles: Set<number>): boolean {
    const { instance, userId } = this;
    const { tileBuildings, tileTypes, width, height } = instance;

    for (const tileIdx of myTiles) {
      if (tileBuildings[tileIdx] != null) continue;
      const x = tileIdx % width;
      const y = Math.floor(tileIdx / width);
      if ((tileTypes[tileIdx] as TileType) === TileType.Water) continue;

      if (
        building === BuildingType.Sawmill ||
        building === BuildingType.Mine ||
        building === BuildingType.FishingHut
      ) {
        const neighbors = orthogonalNeighbors({ x, y }).filter(n => inBounds(n, width, height));
        const adjTypes = neighbors.map(n => tileTypes[idx(n, width)] as TileType);
        if (building === BuildingType.Sawmill    && !adjTypes.some(t => t === TileType.Forest))  continue;
        if (building === BuildingType.Mine        && !adjTypes.some(t => t === TileType.Quarry)) continue;
        if (building === BuildingType.FishingHut  && !adjTypes.some(t => t === TileType.Water))  continue;
      }

      try {
        instance.build(userId, { x, y, building });
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  private tryAttack(playerId: string, myTiles: Set<number>): boolean {
    const { instance, userId } = this;
    const { tileOwners, tileTypes, width, height } = instance;

    const attackable: Vec2[] = [];
    for (const tileIdx of myTiles) {
      const x = tileIdx % width;
      const y = Math.floor(tileIdx / width);
      for (const n of orthogonalNeighbors({ x, y })) {
        if (!inBounds(n, width, height)) continue;
        const ni = idx(n, width);
        const owner = tileOwners[ni];
        if (!owner || owner === playerId) continue;
        if ((tileTypes[ni] as TileType) !== TileType.Plain) continue;
        attackable.push(n);
      }
    }

    if (attackable.length === 0) return false;
    const target = attackable[Math.floor(Math.random() * attackable.length)]!;
    try {
      instance.attackTile(userId, target);
      return true;
    } catch {
      return false;
    }
  }

  private tryExpand(playerId: string, myTiles: Set<number>): void {
    const { instance, userId } = this;
    const { tileOwners, tileTypes, width, height } = instance;

    const claimable = new Set<number>();
    for (const tileIdx of myTiles) {
      const x = tileIdx % width;
      const y = Math.floor(tileIdx / width);
      for (const n of orthogonalNeighbors({ x, y })) {
        if (!inBounds(n, width, height)) continue;
        const ni = idx(n, width);
        if (tileOwners[ni] != null) continue;
        if ((tileTypes[ni] as TileType) !== TileType.Plain) continue;
        claimable.add(ni);
      }
    }

    if (claimable.size === 0) return;

    const positions: Vec2[] = [];
    for (const ni of claimable) {
      if (positions.length >= 5) break;
      positions.push({ x: ni % width, y: Math.floor(ni / width) });
    }

    instance.claimTiles(userId, positions);
  }
}
