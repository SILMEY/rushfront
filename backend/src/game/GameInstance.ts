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
  gameType: "quick" | "custom" = "custom";
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
  onPlacingTimeout:    (() => void) | null = null;

  placingEndsAt = 0;

  // Wonder victory — plusieurs merveilles possibles simultanément
  private wonderTimers = new Map<string, NodeJS.Timeout>(); // playerId → timer
  wonders: Array<{ playerId: string; tileIndex: number; endsAt: number }> = [];

  // O(1) building presence cache — avoids O(n) tileBuildings.some() scans
  private _buildingCounts = new Map<string, Map<number, number>>();

  private _addBuilding(playerId: string, b: number) {
    const m = this._buildingCounts.get(playerId) ?? new Map<number, number>();
    m.set(b, (m.get(b) ?? 0) + 1);
    this._buildingCounts.set(playerId, m);
  }

  private _removeBuilding(playerId: string, b: number) {
    const m = this._buildingCounts.get(playerId);
    if (!m) return;
    const c = m.get(b) ?? 0;
    if (c <= 1) m.delete(b); else m.set(b, c - 1);
  }

  hasBuilding(playerId: string, b: BuildingType): boolean {
    return (this._buildingCounts.get(playerId)?.get(b) ?? 0) > 0;
  }

  private timer: NodeJS.Timeout | null = null;
  private placingTimer: NodeJS.Timeout | null = null;

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

    // 10-second window for players to choose their starting tile
    const PLACING_MS = 10_000;
    this.placingEndsAt = Date.now() + PLACING_MS;
    this.placingTimer = setTimeout(() => void this.handlePlacingTimeout(), PLACING_MS);
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
    if (this.placingTimer) clearTimeout(this.placingTimer);
    this.placingTimer = null;
    for (const t of this.wonderTimers.values()) clearTimeout(t);
    this.wonderTimers.clear();
    this.wonders = [];
  }

  private async handlePlacingTimeout() {
    if (this.status !== "PLACING") return;

    // Mark unchosen players as eliminated — they missed the window
    for (const p of this.players) {
      if (!p.hasChosenStart) p.eliminated = true;
    }

    const chosen = this.players.filter((p) => p.hasChosenStart);

    if (chosen.length === 0) {
      // Nobody chose — just end the game
      this.status = "FINISHED" as any;
      void prisma.game.update({ where: { id: this.id }, data: { status: "FINISHED" } });
      this.onGameOver?.(null);
      return;
    }

    // Start the game with whoever chose in time
    this.start();
    void prisma.game.update({ where: { id: this.id }, data: { status: "ACTIVE" } });
    this.onPlacingTimeout?.(); // ask socket layer to broadcast fresh state

    // If only 1 player chose → immediate win
    if (chosen.length === 1) {
      const winner = chosen[0]!;
      this.stop();
      void prisma.game.update({ where: { id: this.id }, data: { status: "FINISHED" } });
      void prisma.user.update({ where: { id: winner.userId }, data: { quickGameWins: { increment: 1 } } });
      this.onGameOver?.(winner);
    }
  }

  // ── Elimination & win condition ───────────────────────────────────────────

  private doEliminate(playerId: string): TileChange[] {
    const player = this.players.find((p) => p.id === playerId)!;
    player.eliminated = true;
    player.resources = { villagers: 0, soldiers: 0, wood: 0, stone: 0 };
    this._buildingCounts.delete(playerId);

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
      gameType: this.gameType,
      placingEndsAt: this.status === "PLACING" ? this.placingEndsAt : undefined,
      wonders: this.wonders.map(w => ({ playerId: w.playerId, endsAt: w.endsAt })),
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
    (player as any).desiredSoldierPct = 0;
    player.resources = { villagers: 5, soldiers: 0, wood: 25, stone: 5 };
    this.tileOwners[index] = player.id;
    this.tileBuildings[index] = BuildingType.Base;
    this._addBuilding(player.id, BuildingType.Base);

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

    const tileType = this.tileTypes[index] as TileType;
    const isWater = tileType === TileType.Water;
    if (tileType !== TileType.Plain && !isWater) throw new Error("invalid_tile");
    if (this.tileOwners[index]) throw new Error("already_owned");

    const neighborOwned = orthogonalNeighbors(pos).some((n) => {
      if (!inBounds(n, this.width, this.height)) return false;
      return this.tileOwners[idx(n, this.width)] === player.id;
    });
    if (!neighborOwned) throw new Error("not_adjacent");

    if (isWater) {
      const charges = (player as any).bridgeCharges ?? 0;
      if (charges < 1) throw new Error("need_bridge_charge");
      (player as any).bridgeCharges = charges - 1;
    }

    // Claiming costs 1 villager (habitants colonisent les cases)
    if (player.resources.villagers < 1) throw new Error("not_enough_habitants");
    player.resources.villagers -= 1;

    this.tileOwners[index] = player.id;
    const building = isWater ? BuildingType.Bridge : (this.tileBuildings[index] ?? null);
    if (isWater) this.tileBuildings[index] = BuildingType.Bridge;
    return { x: pos.x, y: pos.y, owner: player.id, building };
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

  attackTile(userId: string, pos: Vec2): { change: TileChange; defenderId: string } {
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

    // Caserne obligatoire + au moins 1 soldat
    if (!this.hasBuilding(player.id, BuildingType.Barracks)) throw new Error("need_barracks");
    if (player.resources.soldiers < 1) throw new Error("not_enough_soldiers");

    const defender = this.players.find((p) => p.id === owner)!;

    const atkTechs = new Set(player.techs ?? []);
    const defTechs = new Set(defender.techs ?? []);

    // ── Pertes défenseur : ⌈(pop_totale / cases)⌉, réparti soldats + villageois ──
    const defTiles = this.tileOwners.filter(o => o === defender.id).length;
    const defTotalPop = defender.resources.soldiers + defender.resources.villagers;
    const defRawLoss = defTiles > 0 ? Math.ceil(defTotalPop / defTiles) : 0;
    const defTotalLoss = defTechs.has("cote_de_maille") ? Math.max(1, Math.floor(defRawLoss / 2)) : defRawLoss;

    // Split proportionnel soldats / villageois
    const defSoldierLoss = defTotalPop > 0
      ? Math.round(defTotalLoss * defender.resources.soldiers / defTotalPop)
      : 0;
    const defVillagerLoss = defTotalLoss - defSoldierLoss;

    // ── Pertes attaquant : même total que le défenseur, soldats uniquement ──
    const atkRawLoss = defTotalLoss;
    const atkSoldierLoss = atkTechs.has("epee_longue") ? Math.max(1, Math.floor(atkRawLoss / 2)) : atkRawLoss;

    if (player.resources.soldiers < atkSoldierLoss) throw new Error("not_enough_soldiers");

    defender.resources.soldiers  = Math.max(0, defender.resources.soldiers  - defSoldierLoss);
    defender.resources.villagers = Math.max(0, defender.resources.villagers - defVillagerLoss);
    player.resources.soldiers    = Math.max(0, player.resources.soldiers    - atkSoldierLoss);

    // La case est toujours prise — mettre à jour le cache bâtiments si besoin
    const capturedBuilding = this.tileBuildings[index];
    if (capturedBuilding != null) {
      this._removeBuilding(defender.id, capturedBuilding);
      this._addBuilding(player.id, capturedBuilding);
    }
    this.tileOwners[index] = player.id;

    // Annuler la merveille si sa case est capturée
    const wi = this.wonders.findIndex(w => w.tileIndex === index && w.playerId === defender.id);
    if (wi !== -1) {
      const t = this.wonderTimers.get(defender.id);
      if (t) { clearTimeout(t); this.wonderTimers.delete(defender.id); }
      this.wonders.splice(wi, 1);
    }

    this.checkEliminationOf(defender.id);

    return {
      change: { x: pos.x, y: pos.y, owner: player.id, building: this.tileBuildings[index] ?? null },
      defenderId: defender.id,
      wonders: this.wonders.map(w => ({ playerId: w.playerId, endsAt: w.endsAt }))
    };
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

    // Wonder : un seul par joueur
    if (intent.building === BuildingType.Wonder) {
      if (this.wonders.some(w => w.playerId === player.id)) throw new Error("wonder_already_built");
    }

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
    this._addBuilding(player.id, intent.building);

    // Merveille : démarrer le timer de victoire (10 minutes)
    if (intent.building === BuildingType.Wonder) {
      const WONDER_MS = 10 * 60 * 1000;
      const endsAt = Date.now() + WONDER_MS;
      this.wonders.push({ playerId: player.id, tileIndex, endsAt });
      const timer = setTimeout(() => {
        if (this.tileOwners[tileIndex] === player.id) {
          this.stop();
          void prisma.game.update({ where: { id: this.id }, data: { status: "FINISHED" } });
          void prisma.user.update({ where: { id: player.userId }, data: { quickGameWins: { increment: 1 } } });
          this.onGameOver?.(player);
        }
      }, WONDER_MS);
      this.wonderTimers.set(player.id, timer);
    }

    return { x: intent.x, y: intent.y, owner: player.id, building: intent.building };
  }

  // ── Tech ──────────────────────────────────────────────────────────────────

  buyTech(userId: string, techId: string) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!isTechId(techId)) throw new Error("invalid_tech");

    if (!this.hasBuilding(player.id, BuildingType.University)) throw new Error("need_university");

    const def = TECHS.find((t) => t.id === techId)!;
    const techs = new Set((player as any).techs as string[] | undefined);

    // Non-stackable : un seul achat autorisé
    if (!def.stackable && techs.has(techId)) throw new Error("tech_already_bought");

    if (player.resources.wood < def.cost.wood || player.resources.stone < def.cost.stone)
      throw new Error("not_enough_resources");

    player.resources.wood  -= def.cost.wood;
    player.resources.stone -= def.cost.stone;

    if (def.stackable && techId === "pont") {
      (player as any).bridgeCharges = ((player as any).bridgeCharges ?? 0) + 1;
    }
    techs.add(techId);
    (player as any).techs = Array.from(techs);
  }

  // ── Port : bateaux ────────────────────────────────────────────────────────

  private hasPort(playerId: string): boolean {
    return this.hasBuilding(playerId, BuildingType.FishingHut);
  }

  buyFishingBoat(userId: string) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!this.hasPort(player.id)) throw new Error("need_port");
    if (player.resources.villagers < 1) throw new Error("not_enough_habitants");
    player.resources.villagers -= 1;
    player.fishingBoats = (player.fishingBoats ?? 0) + 1;
  }

  buyTransportBoat(userId: string) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!this.hasPort(player.id)) throw new Error("need_port");
    if (player.resources.villagers < 10) throw new Error("not_enough_habitants");
    player.resources.villagers -= 10;
    player.maritimeCharges = (player.maritimeCharges ?? 0) + 1;
  }

  // Débarquement maritime : réclame une case de plaine adjacente à l'eau (hors adjacence territoire)
  maritimeLand(userId: string, pos: Vec2): TileChange {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (!inBounds(pos, this.width, this.height)) throw new Error("out_of_bounds");

    const charges = player.maritimeCharges ?? 0;
    if (charges < 1) throw new Error("need_maritime_charge");

    const index = idx(pos, this.width);
    const block = this.brouillageTiles.get(index);
    if (block && block.expiresAt > Date.now() && block.casterPlayerId !== player.id)
      throw new Error("tile_blocked");

    if ((this.tileTypes[index] as TileType) !== TileType.Plain) throw new Error("invalid_tile");
    if (this.tileOwners[index]) throw new Error("already_owned");

    const adjToWater = orthogonalNeighbors(pos).some(n => {
      if (!inBounds(n, this.width, this.height)) return false;
      return (this.tileTypes[idx(n, this.width)] as TileType) === TileType.Water;
    });
    if (!adjToWater) throw new Error("needs_adjacent_water");

    if (player.resources.villagers < 1) throw new Error("not_enough_habitants");
    player.resources.villagers -= 1;
    player.maritimeCharges = charges - 1;
    this.tileOwners[index] = player.id;
    return { x: pos.x, y: pos.y, owner: player.id, building: null };
  }

  // ── Brouillage ────────────────────────────────────────────────────────────

  setBrouillage(userId: string, tiles: Vec2[]) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    if (tiles.length < 1 || tiles.length > 3) throw new Error("invalid_tiles_count");

    if (!this.hasBuilding(player.id, BuildingType.University)) throw new Error("need_university");

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
