import { prisma } from "../prisma/client.js";
import { generateMap } from "./mapGenerator.js";
import {
  BuildingType,
  TileType,
  type BuildIntent,
  type ClaimIntent,
  type GamePlayerState,
  type GameStateSnapshot,
  type Vec2
} from "./types.js";
import { TURN_SECONDS, buildCost, idx, inBounds, orthogonalNeighbors } from "./rules.js";
import { resolveTurn } from "./turnResolver.js";

type RuntimePlayer = GamePlayerState;

export class GameInstance {
  readonly id: string;
  status: "PLACING" | "ACTIVE" = "PLACING";
  width = 200;
  height = 200;
  currentTurn = 0;
  turnEndsAt = 0;

  tileTypes!: Uint8Array; // TileType
  tileOwners!: Array<string | null>; // GamePlayer.id
  tileBuildings!: Array<number | null>; // BuildingType
  tileContestedUntil!: Array<number | null>;

  players: RuntimePlayer[] = [];
  claims = new Map<string, Set<number>>(); // playerId -> tile index
  pendingBuilds = new Map<string, BuildIntent[]>(); // playerId -> builds
  brouillageTiles = new Map<number, { casterPlayerId: string; untilTurn: number }>(); // tileIndex -> effect

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
      isReady: p.isReady,
      hasChosenStart: p.hasChosenStart,
      basePosition: p.baseX != null && p.baseY != null ? { x: p.baseX, y: p.baseY } : null,
      resources: { villagers: 0, soldiers: 0, wood: 0, stone: 0 }
    }));

    const map = generateMap();
    this.width = map.width;
    this.height = map.height;
    this.tileTypes = map.types;
    this.tileOwners = Array.from({ length: this.width * this.height }, () => null);
    this.tileBuildings = Array.from({ length: this.width * this.height }, () => null);
    this.tileContestedUntil = Array.from({ length: this.width * this.height }, () => null);

    this.currentTurn = 0;
    this.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
  }

  start() {
    if (this.timer) return;
    this.status = "ACTIVE";
    this.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
    this.timer = setInterval(() => {
      void this.tick();
    }, 250);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.status !== "ACTIVE") return;
    const now = Date.now();
    if (now < this.turnEndsAt) return;
    await this.resolveTurn();
    this.currentTurn++;
    this.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
  }

  snapshot(): GameStateSnapshot {
    const claims: Record<string, ClaimIntent[]> = {};
    for (const [pid, set] of this.claims) {
      claims[pid] = Array.from(set).map((i) => ({ x: i % this.width, y: Math.floor(i / this.width) }));
    }

    const pendingBuilds: Record<string, BuildIntent[]> = {};
    for (const [pid, builds] of this.pendingBuilds) pendingBuilds[pid] = builds;

    const brouillage = Array.from(this.brouillageTiles.entries()).map(([i, v]) => ({
      casterPlayerId: v.casterPlayerId,
      x: i % this.width,
      y: Math.floor(i / this.width),
      untilTurn: v.untilTurn
    }));

    return {
      gameId: this.id,
      status: this.status,
      width: this.width,
      height: this.height,
      currentTurn: this.currentTurn,
      turnEndsAt: this.turnEndsAt,
      players: this.players,
      tiles: {
        types: Array.from(this.tileTypes),
        owners: this.tileOwners,
        buildings: this.tileBuildings,
        contestedUntil: this.tileContestedUntil
      },
      claims,
      pendingBuilds,
      brouillage
    };
  }

  getPlayerByUserId(userId: string) {
    return this.players.find((p) => p.userId === userId) ?? null;
  }

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

    const minDist = 12;
    for (const other of this.players) {
      if (!other.basePosition) continue;
      const d = Math.abs(other.basePosition.x - pos.x) + Math.abs(other.basePosition.y - pos.y);
      if (d < minDist) throw new Error("too_close_to_other_base");
    }

    player.hasChosenStart = true;
    player.basePosition = pos;
    player.resources = { villagers: 10, soldiers: 0, wood: 5, stone: 0 };
    this.tileOwners[index] = player.id;
    this.tileBuildings[index] = BuildingType.Base;

    void prisma.gamePlayer.update({
      where: { id: player.id },
      data: { hasChosenStart: true, baseX: pos.x, baseY: pos.y }
    });

    const allChosen = this.players.every((p) => p.hasChosenStart);
    if (allChosen) {
      this.start();
      void prisma.game.update({ where: { id: this.id }, data: { status: "ACTIVE" } });
    }
  }

  claimTile(userId: string, pos: Vec2) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!inBounds(pos, this.width, this.height)) throw new Error("out_of_bounds");

    const index = idx(pos, this.width);
    const block = this.brouillageTiles.get(index);
    if (block && block.untilTurn >= this.currentTurn && block.casterPlayerId !== player.id) throw new Error("tile_blocked");

    const type = this.tileTypes[index] as TileType;
    if (type === TileType.Water) throw new Error("water");
    if (this.tileOwners[index]) throw new Error("already_owned");

    const neighborOwned = orthogonalNeighbors(pos).some((n) => {
      if (!inBounds(n, this.width, this.height)) return false;
      return this.tileOwners[idx(n, this.width)] === player.id;
    });
    if (!neighborOwned) throw new Error("not_adjacent");

    const set = this.claims.get(player.id) ?? new Set<number>();
    set.add(index);
    this.claims.set(player.id, set);
  }

  cancelClaim(userId: string, pos: Vec2) {
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!inBounds(pos, this.width, this.height)) return;
    const index = idx(pos, this.width);
    this.claims.get(player.id)?.delete(index);
  }

  build(userId: string, intent: BuildIntent) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!inBounds({ x: intent.x, y: intent.y }, this.width, this.height)) throw new Error("out_of_bounds");

    const pos = { x: intent.x, y: intent.y };
    const tileIndex = idx(pos, this.width);
    const block = this.brouillageTiles.get(tileIndex);
    if (block && block.untilTurn >= this.currentTurn && block.casterPlayerId !== player.id) throw new Error("tile_blocked");
    if (this.tileOwners[tileIndex] !== player.id) throw new Error("must_own_tile");
    if (this.tileBuildings[tileIndex] != null) throw new Error("tile_has_building");
    if ((this.tileTypes[tileIndex] as TileType) === TileType.Water) throw new Error("invalid_tile");

    const cost = buildCost(intent.building);
    if (player.resources.wood < cost.wood || player.resources.stone < cost.stone) throw new Error("not_enough_resources");

    const neighbors = orthogonalNeighbors(pos).filter((n) => inBounds(n, this.width, this.height));
    const adjTypes = neighbors.map((n) => this.tileTypes[idx(n, this.width)] as TileType);
    if (intent.building === BuildingType.FishingHut) {
      if (!adjTypes.some((t) => t === TileType.Water)) throw new Error("needs_adjacent_water");
    }
    if (intent.building === BuildingType.Sawmill) {
      if (!adjTypes.some((t) => t === TileType.Forest)) throw new Error("needs_adjacent_forest");
    }
    if (intent.building === BuildingType.Mine) {
      if (!adjTypes.some((t) => t === TileType.Quarry)) throw new Error("needs_adjacent_quarry");
    }

    // Reserve resources immediately to provide feedback and avoid queuing overspends.
    player.resources.wood -= cost.wood;
    player.resources.stone -= cost.stone;

    const builds = this.pendingBuilds.get(player.id) ?? [];
    builds.push(intent);
    this.pendingBuilds.set(player.id, builds);
  }

  setBrouillage(userId: string, tiles: Vec2[]) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (tiles.length < 1 || tiles.length > 3) throw new Error("invalid_tiles_count");

    // Require at least one University owned by the player.
    let hasUniversity = false;
    for (let i = 0; i < this.tileBuildings.length; i++) {
      if (this.tileOwners[i] === player.id && this.tileBuildings[i] === BuildingType.University) {
        hasUniversity = true;
        break;
      }
    }
    if (!hasUniversity) throw new Error("need_university");

    const untilTurn = this.currentTurn + 1;
    for (const t of tiles) {
      if (!inBounds(t, this.width, this.height)) throw new Error("out_of_bounds");
      const i = idx(t, this.width);
      const type = this.tileTypes[i] as TileType;
      if (type === TileType.Water) throw new Error("invalid_tile");
      // Only neutral tiles can be targeted (prevents locking already-owned enemy tiles).
      if (this.tileOwners[i] != null) throw new Error("must_target_neutral");
      this.brouillageTiles.set(i, { casterPlayerId: player.id, untilTurn });
    }
  }

  private async resolveTurn() {
    resolveTurn({
      gameId: this.id,
      width: this.width,
      height: this.height,
      currentTurn: this.currentTurn,
      players: this.players,
      tileTypes: this.tileTypes,
      tileOwners: this.tileOwners,
      tileBuildings: this.tileBuildings,
      tileContestedUntil: this.tileContestedUntil,
      claims: this.claims,
      pendingBuilds: this.pendingBuilds
    });

    // Expire brouillage effects.
    for (const [tileIndex, effect] of this.brouillageTiles) {
      if (effect.untilTurn <= this.currentTurn) this.brouillageTiles.delete(tileIndex);
    }

    // Reset per-turn intents (resolver mutates arrays/resources in-place)
    this.claims = new Map();
    this.pendingBuilds = new Map();
  }
}
