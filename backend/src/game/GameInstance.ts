import { prisma } from "../prisma/client.js";
import { generateMap } from "./mapGenerator.js";
import {
  BuildingType,
  TileType,
  type BuildIntent,
  type CivilizationId,
  type GamePlayerState,
  type GameStateSnapshot,
  type TileChange,
  type Vec2
} from "./types.js";
import { buildCost, idx, inBounds, orthogonalNeighbors } from "./rules.js";
import { applyProduction } from "./turnResolver.js";
import { TECHS, isTechId } from "./tech.js";

type RuntimePlayer = GamePlayerState;

type ResourcePatch = { id: string; resources: RuntimePlayer["resources"] };

export class GameInstance {
  readonly id: string;
  status: "PLACING" | "ACTIVE" = "PLACING";
  width = 200;
  height = 200;

  tileTypes!: Uint8Array;
  tileOwners!: Array<string | null>;
  tileBuildings!: Array<number | null>;

  players: RuntimePlayer[] = [];

  // Brouillage: time-based expiry (no turns)
  brouillageTiles = new Map<number, { casterPlayerId: string; expiresAt: number }>();

  onResourceTick:      ((players: ResourcePatch[]) => void) | null = null;
  onPlayerEliminated:  ((playerId: string, changes: TileChange[]) => void) | null = null;
  onGameOver:          ((winner: RuntimePlayer | null) => void) | null = null;

  private timer: NodeJS.Timeout | null = null;

  constructor(id: string) {
    this.id = id;
  }

  async loadFromDb() {
    const game = await prisma.game.findUnique({
      where: { id: this.id },
      include: { players: { include: { user: true } } }
    });
    if (!game) throw new Error("game_not_found");
    this.status = game.status === "ACTIVE" ? "ACTIVE" : "PLACING";

    this.players = game.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.pseudo ?? p.user.name,
      avatarUrl: p.user.avatarUrl,
      color: p.color,
      civilization: p.civilization as CivilizationId,
      isReady: p.isReady,
      hasChosenStart: p.hasChosenStart,
      basePosition: p.baseX != null && p.baseY != null ? { x: p.baseX, y: p.baseY } : null,
      resources: { villagers: 0, soldiers: 0, wood: 0, stone: 0 },
      techs: [],
      desiredSoldierPct: 50
    }));

    const map = generateMap();
    this.width = map.width;
    this.height = map.height;
    this.tileTypes = map.types;
    this.tileOwners = Array.from({ length: this.width * this.height }, () => null);
    this.tileBuildings = Array.from({ length: this.width * this.height }, () => null);
  }

  start() {
    if (this.timer) return;
    this.status = "ACTIVE";
    this.timer = setInterval(() => {
      applyProduction({
        players: this.players,
        tileOwners: this.tileOwners,
        tileBuildings: this.tileBuildings,
        tileTypes: this.tileTypes,
        width: this.width,
        height: this.height
      });
      // Expire brouillage
      const now = Date.now();
      for (const [i, e] of this.brouillageTiles) {
        if (e.expiresAt <= now) this.brouillageTiles.delete(i);
      }
      this.onResourceTick?.(this.players.map((p) => ({ id: p.id, resources: p.resources })));
    }, 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ── Elimination & win condition ───────────────────────────────────────────

  private doEliminate(playerId: string): TileChange[] {
    const player = this.players.find((p) => p.id === playerId)!;
    player.eliminated = true;
    player.resources = { villagers: 0, soldiers: 0, wood: 0, stone: 0 };

    const changes: TileChange[] = [];
    for (let i = 0; i < this.tileOwners.length; i++) {
      if (this.tileOwners[i] === playerId) {
        this.tileOwners[i] = null;
        this.tileBuildings[i] = null;
        changes.push({ x: i % this.width, y: Math.floor(i / this.width), owner: null, building: null });
      }
    }

    this.onPlayerEliminated?.(playerId, changes);
    this.checkGameOver();
    return changes;
  }

  private checkGameOver() {
    const alive = this.players.filter((p) => p.hasChosenStart && !p.eliminated);
    if (alive.length > 1) return;

    const winner = alive[0] ?? null;
    this.stop();
    void prisma.game.update({ where: { id: this.id }, data: { status: "FINISHED" } });
    if (winner) {
      void prisma.user.update({
        where: { id: winner.userId },
        data: { quickGameWins: { increment: 1 } }
      });
    }
    this.onGameOver?.(winner);
  }

  private checkEliminationOf(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.eliminated || !player.hasChosenStart) return;
    if (!this.tileOwners.some((o) => o === playerId)) {
      this.doEliminate(playerId);
    }
  }

  // Surrender called on disconnect or explicit quit — returns changes if player was active
  surrenderPlayer(userId: string): TileChange[] | null {
    const player = this.getPlayerByUserId(userId);
    if (!player || player.eliminated || !player.hasChosenStart || this.status !== "ACTIVE") return null;
    return this.doEliminate(player.id);
  }

  snapshot(): GameStateSnapshot {
    const brouillage = Array.from(this.brouillageTiles.entries()).map(([i, v]) => ({
      casterPlayerId: v.casterPlayerId,
      x: i % this.width,
      y: Math.floor(i / this.width),
      expiresAt: v.expiresAt
    }));

    return {
      gameId: this.id,
      status: this.status,
      width: this.width,
      height: this.height,
      players: this.players,
      tiles: {
        types: Array.from(this.tileTypes),
        owners: this.tileOwners,
        buildings: this.tileBuildings
      },
      brouillage
    };
  }

  getPlayerByUserId(userId: string) {
    return this.players.find((p) => p.userId === userId) ?? null;
  }

  // ── Placement ─────────────────────────────────────────────────────────────

  chooseStart(userId: string, pos: Vec2) {
    if (this.status !== "PLACING") throw new Error("not_placing");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (player.hasChosenStart) throw new Error("already_chosen");
    if (!inBounds(pos, this.width, this.height)) throw new Error("out_of_bounds");

    const index = idx(pos, this.width);
    const type = this.tileTypes[index] as TileType;
    if (type === TileType.Water) throw new Error("invalid_tile");
    if (type !== TileType.Plain) throw new Error("start_must_be_plain");
    if (this.tileOwners[index]) throw new Error("occupied");

    for (const other of this.players) {
      if (!other.basePosition) continue;
      if (Math.abs(other.basePosition.x - pos.x) + Math.abs(other.basePosition.y - pos.y) < 12)
        throw new Error("too_close_to_other_base");
    }

    player.hasChosenStart = true;
    player.basePosition = pos;
    (player as any).techs = [];
    (player as any).desiredSoldierPct = 50;
    player.resources = { villagers: 10, soldiers: 5, wood: 5, stone: 0 };
    this.tileOwners[index] = player.id;
    this.tileBuildings[index] = BuildingType.Base;

    void prisma.gamePlayer.update({
      where: { id: player.id },
      data: { hasChosenStart: true, baseX: pos.x, baseY: pos.y }
    });

    if (this.players.every((p) => p.hasChosenStart)) {
      this.start();
      void prisma.game.update({ where: { id: this.id }, data: { status: "ACTIVE" } });
    }
  }

  // ── Claim (immediate) ─────────────────────────────────────────────────────

  claimTile(userId: string, pos: Vec2): TileChange {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!inBounds(pos, this.width, this.height)) throw new Error("out_of_bounds");

    const index = idx(pos, this.width);

    const block = this.brouillageTiles.get(index);
    if (block && block.expiresAt > Date.now() && block.casterPlayerId !== player.id)
      throw new Error("tile_blocked");

    if ((this.tileTypes[index] as TileType) !== TileType.Plain) throw new Error("invalid_tile");
    if (this.tileOwners[index]) throw new Error("already_owned");

    const neighborOwned = orthogonalNeighbors(pos).some((n) => {
      if (!inBounds(n, this.width, this.height)) return false;
      return this.tileOwners[idx(n, this.width)] === player.id;
    });
    if (!neighborOwned) throw new Error("not_adjacent");

    // Civilization claim cost
    let cost = 1;
    if (player.civilization === "steppe_horde") {
      cost = 0;
    } else if (player.civilization === "sylvan_elves") {
      const adjForest = orthogonalNeighbors(pos).some((n) => {
        if (!inBounds(n, this.width, this.height)) return false;
        return (this.tileTypes[idx(n, this.width)] as TileType) === TileType.Forest;
      });
      if (adjForest) cost = 0;
    }
    const techs = new Set((player as any).techs as string[] | undefined);
    if (techs.has("logistics")) cost = Math.max(0, cost - 1);

    if (player.resources.soldiers < cost) throw new Error("not_enough_soldiers");
    player.resources.soldiers -= cost;

    this.tileOwners[index] = player.id;
    return { x: pos.x, y: pos.y, owner: player.id, building: this.tileBuildings[index] ?? null };
  }

  claimTiles(userId: string, positions: Vec2[]): TileChange[] {
    const changes: TileChange[] = [];
    for (const pos of positions) {
      try {
        changes.push(this.claimTile(userId, pos));
      } catch {
        // Skip invalid tiles silently (common when painting)
      }
    }
    return changes;
  }

  // ── Attack (immediate) ────────────────────────────────────────────────────

  attackTile(userId: string, pos: Vec2, amount: number): TileChange {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!inBounds(pos, this.width, this.height)) throw new Error("out_of_bounds");

    const index = idx(pos, this.width);
    const block = this.brouillageTiles.get(index);
    if (block && block.expiresAt > Date.now() && block.casterPlayerId !== player.id)
      throw new Error("tile_blocked");

    if ((this.tileTypes[index] as TileType) !== TileType.Plain) throw new Error("invalid_tile");
    const owner = this.tileOwners[index];
    if (!owner) throw new Error("not_owned");
    if (owner === player.id) throw new Error("already_own");

    const neighborOwned = orthogonalNeighbors(pos).some((n) => {
      if (!inBounds(n, this.width, this.height)) return false;
      return this.tileOwners[idx(n, this.width)] === player.id;
    });
    if (!neighborOwned) throw new Error("not_adjacent");

    const N = Math.max(0, Math.floor(amount));
    if (N <= 0) throw new Error("invalid_amount");
    if (player.resources.soldiers < N) throw new Error("not_enough_soldiers");

    const defender = this.players.find((p) => p.id === owner)!;
    const D = Math.max(0, defender.resources.soldiers);

    const atkMult = player.civilization === "steppe_horde" ? 1.5
                  : player.civilization === "iron_dwarves"  ? 0.75 : 1.0;
    const defMult = defender.civilization === "iron_dwarves"  ? 1.5
                  : defender.civilization === "steppe_horde"  ? 0.75 : 1.0;

    const N_eff = Math.round(N * atkMult);
    const D_eff = Math.round(D * defMult);

    defender.resources.soldiers -= Math.min(N_eff, D);
    player.resources.soldiers   -= Math.min(D_eff, N);

    const captured = N_eff > D_eff;
    if (captured) {
      this.tileOwners[index] = player.id;
      // Check if defender lost all territory
      this.checkEliminationOf(defender.id);
    }

    return { x: pos.x, y: pos.y, owner: captured ? player.id : owner, building: this.tileBuildings[index] ?? null };
  }

  // ── Build (immediate) ─────────────────────────────────────────────────────

  build(userId: string, intent: BuildIntent): TileChange {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");

    const pos = { x: intent.x, y: intent.y };
    if (!inBounds(pos, this.width, this.height)) throw new Error("out_of_bounds");
    const tileIndex = idx(pos, this.width);

    const block = this.brouillageTiles.get(tileIndex);
    if (block && block.expiresAt > Date.now() && block.casterPlayerId !== player.id)
      throw new Error("tile_blocked");

    if (this.tileOwners[tileIndex] !== player.id) throw new Error("must_own_tile");
    if (this.tileBuildings[tileIndex] != null) throw new Error("tile_has_building");
    if ((this.tileTypes[tileIndex] as TileType) === TileType.Water) throw new Error("invalid_tile");

    const cost = buildCost(intent.building);
    if (player.resources.wood < cost.wood || player.resources.stone < cost.stone)
      throw new Error("not_enough_resources");

    const neighbors = orthogonalNeighbors(pos).filter((n) => inBounds(n, this.width, this.height));
    const adjTypes = neighbors.map((n) => this.tileTypes[idx(n, this.width)] as TileType);
    if (intent.building === BuildingType.FishingHut && !adjTypes.some((t) => t === TileType.Water))
      throw new Error("needs_adjacent_water");
    if (intent.building === BuildingType.Sawmill && !adjTypes.some((t) => t === TileType.Forest))
      throw new Error("needs_adjacent_forest");
    if (intent.building === BuildingType.Mine && !adjTypes.some((t) => t === TileType.Quarry))
      throw new Error("needs_adjacent_quarry");

    player.resources.wood  -= cost.wood;
    player.resources.stone -= cost.stone;
    this.tileBuildings[tileIndex] = intent.building;

    return { x: intent.x, y: intent.y, owner: player.id, building: intent.building };
  }

  // ── Tech ──────────────────────────────────────────────────────────────────

  buyTech(userId: string, techId: string) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!isTechId(techId)) throw new Error("invalid_tech");

    let hasUniversity = false;
    for (let i = 0; i < this.tileBuildings.length; i++) {
      if (this.tileOwners[i] === player.id && this.tileBuildings[i] === BuildingType.University) {
        hasUniversity = true;
        break;
      }
    }
    if (!hasUniversity) throw new Error("need_university");

    const techs = new Set((player as any).techs as string[] | undefined);
    if (techs.has(techId)) throw new Error("tech_already_bought");

    const def = TECHS.find((t) => t.id === techId)!;
    if (player.resources.wood < def.cost.wood || player.resources.stone < def.cost.stone)
      throw new Error("not_enough_resources");

    player.resources.wood  -= def.cost.wood;
    player.resources.stone -= def.cost.stone;
    techs.add(techId);
    (player as any).techs = Array.from(techs);
  }

  // ── Brouillage ────────────────────────────────────────────────────────────

  setBrouillage(userId: string, tiles: Vec2[]) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (tiles.length < 1 || tiles.length > 3) throw new Error("invalid_tiles_count");

    let hasUniversity = false;
    for (let i = 0; i < this.tileBuildings.length; i++) {
      if (this.tileOwners[i] === player.id && this.tileBuildings[i] === BuildingType.University) {
        hasUniversity = true;
        break;
      }
    }
    if (!hasUniversity) throw new Error("need_university");

    const expiresAt = Date.now() + 3000; // blocks for 3 seconds
    for (const t of tiles) {
      if (!inBounds(t, this.width, this.height)) throw new Error("out_of_bounds");
      const i = idx(t, this.width);
      if ((this.tileTypes[i] as TileType) === TileType.Water) throw new Error("invalid_tile");
      if (this.tileOwners[i] != null) throw new Error("must_target_neutral");
      this.brouillageTiles.set(i, { casterPlayerId: player.id, expiresAt });
    }
  }
}
