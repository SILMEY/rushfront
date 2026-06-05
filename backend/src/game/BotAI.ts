import type { GameInstance } from "./GameInstance.js";
import { BuildingType, TileType, type CivilizationId, type Vec2 } from "./types.js";
import { idx, inBounds, orthogonalNeighbors } from "./rules.js";

const TICK_BASE_MS = 800;
const TICK_JITTER_MS = 400;

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

    let myTiles = instance.getTilesOf(player.id);
    if (myTiles.size === 0) return;

    const civ = player.civilization as CivilizationId;

    // ── 1. EXPANSION (toujours, avec tous les villageois disponibles) ───────
    if (player.resources.villagers > 0) {
      this.expand(myTiles, player.resources.villagers);
      myTiles = instance.getTilesOf(player.id); // rafraîchir après expansion
    }

    // ── 2. CONSTRUCTION (en plus de l'expansion, pas à la place) ────────────
    const hasBarracks = instance.hasBuilding(player.id, BuildingType.Barracks);
    const sawmills    = instance.buildingCount(player.id, BuildingType.Sawmill);
    const mines       = instance.buildingCount(player.id, BuildingType.Mine);

    // Steppe Horde : caserne avant tout
    if (civ === "steppe_horde" && !hasBarracks
        && player.resources.wood >= 20 && player.resources.stone >= 10) {
      this.tryBuild(BuildingType.Barracks, myTiles);
    }

    // Scieries (1 par tranche de 12 cases)
    const maxSawmills = Math.floor(myTiles.size / 12) + 1;
    if (player.resources.wood >= 5 && sawmills < maxSawmills) {
      this.tryBuild(BuildingType.Sawmill, myTiles);
    }

    // Mines (1 par tranche de 15 cases)
    const maxMines = Math.floor(myTiles.size / 15) + 1;
    if (player.resources.wood >= 10 && mines < maxMines) {
      this.tryBuild(BuildingType.Mine, myTiles);
    }

    // Caserne (dès qu'on a 4+ cases et les ressources)
    if (!hasBarracks && myTiles.size >= 4
        && player.resources.wood >= 20 && player.resources.stone >= 10) {
      this.tryBuild(BuildingType.Barracks, myTiles);
    }

    // ── 3. POURCENTAGE DE SOLDATS ───────────────────────────────────────────
    player.desiredSoldierPct = this.targetSoldierPct(civ, myTiles.size);

    // ── 4. ATTAQUE (plusieurs fois pour la Horde, une fois pour les autres) ──
    const hasBarracksNow = instance.hasBuilding(player.id, BuildingType.Barracks);
    if (hasBarracksNow) {
      const threshold = civ === "steppe_horde" ? 3 : civ === "iron_dwarves" ? 12 : 6;
      const maxAttacks = civ === "steppe_horde" ? 3 : 1;
      for (let i = 0; i < maxAttacks; i++) {
        if (player.resources.soldiers < threshold) break;
        const freshTiles = instance.getTilesOf(player.id);
        if (!this.tryAttack(player.id, freshTiles)) break;
      }
    }
  }

  private targetSoldierPct(civ: CivilizationId, tileCount: number): number {
    let base = 25;
    if (tileCount > 60)  base = 40;
    if (tileCount > 150) base = 55;

    switch (civ) {
      case "steppe_horde":    return Math.min(75, base + 25);
      case "iron_dwarves":    return Math.min(60, base + 10);
      case "sylvan_elves":    return base;
      case "aurelian_empire": return Math.max(10, base - 15);
    }
  }

  // ── Expansion ─────────────────────────────────────────────────────────────
  // Utilise tous les villageois disponibles et priorise les cases
  // adjacentes aux forêts et carrières (pour les futurs bâtiments).
  private expand(myTiles: Set<number>, villagers: number): void {
    const { instance, userId } = this;
    const { tileOwners, tileTypes, width, height } = instance;

    const seen = new Set<number>();
    const candidates: { pos: Vec2; score: number }[] = [];

    for (const tileIdx of myTiles) {
      const x = tileIdx % width;
      const y = Math.floor(tileIdx / width);
      for (const n of orthogonalNeighbors({ x, y })) {
        if (!inBounds(n, width, height)) continue;
        const ni = idx(n, width);
        if (seen.has(ni)) continue;
        seen.add(ni);
        if (tileOwners[ni] != null) continue;
        if ((tileTypes[ni] as TileType) !== TileType.Plain) continue;

        // Scorer : +2 par forêt/carrière adjacente (pour bâtiments de prod)
        let score = 0;
        for (const nn of orthogonalNeighbors(n)) {
          if (!inBounds(nn, width, height)) continue;
          const t = tileTypes[idx(nn, width)] as TileType;
          if (t === TileType.Forest || t === TileType.Quarry) score += 2;
        }
        candidates.push({ pos: n, score });
      }
    }

    if (candidates.length === 0) return;

    // Meilleures cases en premier, limité par les villageois disponibles
    candidates.sort((a, b) => b.score - a.score);
    const positions = candidates.slice(0, Math.min(villagers, candidates.length)).map(c => c.pos);
    instance.claimTiles(userId, positions);
  }

  // ── Construction ──────────────────────────────────────────────────────────
  private tryBuild(building: BuildingType, myTiles: Set<number>): boolean {
    const { instance, userId } = this;
    const { tileBuildings, tileTypes, width, height } = instance;

    for (const tileIdx of myTiles) {
      if (tileBuildings[tileIdx] != null) continue;
      const x = tileIdx % width;
      const y = Math.floor(tileIdx / width);
      if ((tileTypes[tileIdx] as TileType) === TileType.Water) continue;

      if (building === BuildingType.Sawmill || building === BuildingType.Mine || building === BuildingType.FishingHut) {
        const neighbors = orthogonalNeighbors({ x, y }).filter(n => inBounds(n, width, height));
        const adjTypes  = neighbors.map(n => tileTypes[idx(n, width)] as TileType);
        if (building === BuildingType.Sawmill   && !adjTypes.some(t => t === TileType.Forest))  continue;
        if (building === BuildingType.Mine       && !adjTypes.some(t => t === TileType.Quarry)) continue;
        if (building === BuildingType.FishingHut && !adjTypes.some(t => t === TileType.Water))  continue;
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

  // ── Attaque ───────────────────────────────────────────────────────────────
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
}
