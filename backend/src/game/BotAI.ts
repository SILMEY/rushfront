import type { GameInstance } from "./GameInstance.js";
import { BuildingType, TileType, type CivilizationId, type TileChange, type Vec2 } from "./types.js";
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

  // ── Placement ─────────────────────────────────────────────────────────────

  place() {
    const { instance, userId } = this;
    if (instance.status !== "PLACING") return;
    const player = instance.getPlayerByUserId(userId);
    if (!player || player.hasChosenStart) return;

    if (this.placeRandom(400)) return;
    if (this.placeScan(12)) return;
    this.placeScan(6);
  }

  private placeRandom(attempts: number): boolean {
    const { instance, userId } = this;
    const { tileTypes, tileOwners, width, height } = instance;

    for (let i = 0; i < attempts; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      if ((tileTypes[y * width + x] as TileType) !== TileType.Plain) continue;
      if (tileOwners[y * width + x]) continue;
      if (this.tooClose(x, y, 12)) continue;

      try { instance.chooseStart(userId, { x, y }); return true; }
      catch { continue; }
    }
    return false;
  }

  private placeScan(minDist: number): boolean {
    const { instance, userId } = this;
    const { tileTypes, tileOwners, width, height } = instance;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((tileTypes[y * width + x] as TileType) !== TileType.Plain) continue;
        if (tileOwners[y * width + x]) continue;
        if (this.tooClose(x, y, minDist)) continue;

        try { instance.chooseStart(userId, { x, y }); return true; }
        catch { continue; }
      }
    }
    return false;
  }

  private tooClose(x: number, y: number, minDist: number): boolean {
    for (const p of this.instance.players) {
      if (!p.basePosition) continue;
      if (Math.abs(p.basePosition.x - x) + Math.abs(p.basePosition.y - y) < minDist) return true;
    }
    return false;
  }

  // ── Boucle ────────────────────────────────────────────────────────────────

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
    try {
      this.doTick();
    } catch (err) {
      console.error("[BotAI] tick error:", err);
    }
  }

  private doTick() {
    const { instance, userId } = this;
    const player = instance.getPlayerByUserId(userId);
    if (!player || player.eliminated) { this.stop(); return; }
    if (instance.status !== "ACTIVE") return;

    let myTiles = instance.getTilesOf(player.id);
    if (myTiles.size === 0) return;

    const civ = player.civilization as CivilizationId;

    // Changements accumulés pendant ce tick — émis en une seule fois à la fin
    const tickChanges: TileChange[] = [];
    const affectedIds = new Set<string>([player.id]);
    let latestWonders = instance.wonders.map(w => ({ playerId: w.playerId, endsAt: w.endsAt }));

    // ── 1. EXPANSION ─────────────────────────────────────────────────────────
    const reserve = myTiles.size < 20 ? 2 : 1;
    // Cap à 10 pour éviter des messages socket géants et une croissance irréaliste
    const toExpand = Math.min(Math.max(0, player.resources.villagers - reserve), 10);
    if (toExpand > 0) {
      const changes = this.expand(myTiles, toExpand);
      tickChanges.push(...changes);
      if (changes.length > 0) myTiles = instance.getTilesOf(player.id);
    }

    // ── 2. CONSTRUCTION ──────────────────────────────────────────────────────
    const hasBarracks = instance.hasBuilding(player.id, BuildingType.Barracks);
    const sawmills    = instance.buildingCount(player.id, BuildingType.Sawmill);
    const mines       = instance.buildingCount(player.id, BuildingType.Mine);

    if (civ === "steppe_horde" && !hasBarracks
        && player.resources.wood >= 20 && player.resources.stone >= 10) {
      const c = this.tryBuild(BuildingType.Barracks, myTiles);
      if (c) tickChanges.push(c);
    }

    const maxSawmills = Math.floor(myTiles.size / 12) + 1;
    if (player.resources.wood >= 5 && sawmills < maxSawmills) {
      const c = this.tryBuild(BuildingType.Sawmill, myTiles);
      if (c) tickChanges.push(c);
    }

    const maxMines = Math.floor(myTiles.size / 15) + 1;
    if (player.resources.wood >= 10 && mines < maxMines) {
      const c = this.tryBuild(BuildingType.Mine, myTiles);
      if (c) tickChanges.push(c);
    }

    if (!hasBarracks && myTiles.size >= 4
        && player.resources.wood >= 20 && player.resources.stone >= 10) {
      const c = this.tryBuild(BuildingType.Barracks, myTiles);
      if (c) tickChanges.push(c);
    }

    // ── 3. POURCENTAGE DE SOLDATS ────────────────────────────────────────────
    player.desiredSoldierPct = this.targetSoldierPct(civ, myTiles.size);

    // ── 4. ATTAQUE ───────────────────────────────────────────────────────────
    const hasBarracksNow = instance.hasBuilding(player.id, BuildingType.Barracks);
    if (hasBarracksNow) {
      const threshold  = civ === "steppe_horde" ? 3 : civ === "iron_dwarves" ? 12 : 6;
      const maxAttacks = civ === "steppe_horde" ? 3 : 1;
      for (let i = 0; i < maxAttacks; i++) {
        if (player.resources.soldiers < threshold) break;
        const result = this.tryAttack(player.id, instance.getTilesOf(player.id));
        if (!result) break;
        tickChanges.push(result.change);
        affectedIds.add(result.defenderId);
        latestWonders = result.wonders;
      }
    }

    // ── 5. ÉMETTRE TOUS LES CHANGEMENTS EN UNE FOIS ──────────────────────────
    if (tickChanges.length > 0) {
      const playerPatches = Array.from(affectedIds)
        .map(pid => instance.players.find(p => p.id === pid))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .map(p => ({ id: p.id, resources: p.resources }));
      instance.onBotAction?.(tickChanges, playerPatches, latestWonders);
    }
  }

  private targetSoldierPct(civ: CivilizationId, tileCount: number): number {
    if (tileCount < 10) return 0;

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

  // ── Expansion (retourne les TileChange) ───────────────────────────────────
  private expand(myTiles: Set<number>, maxToUse: number): TileChange[] {
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

        let score = 0;
        for (const nn of orthogonalNeighbors(n)) {
          if (!inBounds(nn, width, height)) continue;
          const t = tileTypes[idx(nn, width)] as TileType;
          if (t === TileType.Forest || t === TileType.Quarry) score += 2;
        }
        candidates.push({ pos: n, score });
      }
    }

    if (candidates.length === 0) return [];
    candidates.sort((a, b) => b.score - a.score);
    const positions = candidates.slice(0, maxToUse).map(c => c.pos);
    return instance.claimTiles(userId, positions);
  }

  // ── Construction (retourne le TileChange ou null) ─────────────────────────
  private tryBuild(building: BuildingType, myTiles: Set<number>): TileChange | null {
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

      try { return instance.build(userId, { x, y, building }); }
      catch { continue; }
    }
    return null;
  }

  // ── Attaque (retourne le résultat ou null) ────────────────────────────────
  private tryAttack(playerId: string, myTiles: Set<number>): { change: TileChange; defenderId: string; wonders: Array<{ playerId: string; endsAt: number }> } | null {
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

    if (attackable.length === 0) return null;
    const target = attackable[Math.floor(Math.random() * attackable.length)]!;
    try { return instance.attackTile(userId, target); }
    catch { return null; }
  }
}
