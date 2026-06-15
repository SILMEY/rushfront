import { prisma } from "../prisma/client.js";

// ELO pairwise : winner vs moyenne des adversaires humains, K=32
function computeEloUpdates(winnerElo: number, loserElos: number[]) {
  const K = 32;
  const avgOpp = loserElos.reduce((s, e) => s + e, 0) / loserElos.length;
  const winnerDelta = Math.round(K * (1 - 1 / (1 + Math.pow(10, (avgOpp - winnerElo) / 400))));
  const loserDeltas = loserElos.map(e =>
    -Math.round(K * (1 / (1 + Math.pow(10, (winnerElo - e) / 400))))
  );
  return { winnerDelta, loserDeltas };
}
import { generateMap } from "./mapGenerator.js";
import {
  BuildingType,
  TileType,
  type BuildIntent,
  type CivilizationId,
  type GalleonState,
  type GamePlayerState,
  type GameStateSnapshot,
  type TileChange,
  type Vec2
} from "./types.js";
import { buildCost, idx, inBounds, orthogonalNeighbors, GALLEON_COST, GALLEON_HP, GALLEON_MAX_PER_PORT, GALLEON_ATTACK_RANGE } from "./rules.js";
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
  onBotAction:         ((changes: TileChange[], players: ResourcePatch[], wonders: Array<{ playerId: string; endsAt: number }>) => void) | null = null;
  onGameStart:         (() => void) | null = null;
  onGalleonUpdate:     ((galleons: GalleonState[], fires: Array<{ from: Vec2; to: Vec2 }>) => void) | null = null;

  placingEndsAt = 0;

  // Wonder victory — plusieurs merveilles possibles simultanément
  private wonderTimers = new Map<string, NodeJS.Timeout>(); // playerId → timer
  wonders: Array<{ playerId: string; tileIndex: number; endsAt: number }> = [];

  galleons: GalleonState[] = [];
  private galleonTickCounter = 0;

  // O(1) building presence cache — avoids O(n) tileBuildings.some() scans
  private _buildingCounts = new Map<string, Map<number, number>>();

  // O(1) tile ownership lookup — avoids O(n) filter/some on tileOwners
  private _tilesByPlayer = new Map<string, Set<number>>();

  private _addTile(playerId: string, index: number) {
    let s = this._tilesByPlayer.get(playerId);
    if (!s) { s = new Set(); this._tilesByPlayer.set(playerId, s); }
    s.add(index);
  }

  private _removeTile(playerId: string, index: number) {
    this._tilesByPlayer.get(playerId)?.delete(index);
  }

  tileCount(playerId: string): number {
    return this._tilesByPlayer.get(playerId)?.size ?? 0;
  }

  getTilesOf(playerId: string): Set<number> {
    return this._tilesByPlayer.get(playerId) ?? new Set();
  }

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

  buildingCount(playerId: string, b: BuildingType): number {
    return this._buildingCounts.get(playerId)?.get(b) ?? 0;
  }

  private timer: NodeJS.Timeout | null = null;
  private placingTimer: NodeJS.Timeout | null = null;
  private maxDurationTimer: NodeJS.Timeout | null = null;
  private bots: { stop(): void }[] = [];

  registerBot(bot: { stop(): void }) {
    this.bots.push(bot);
  }

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
    const PLACING_MS = 20_000;
    this.placingEndsAt = Date.now() + PLACING_MS;
    this.placingTimer = setTimeout(() => { void this.handlePlacingTimeout().catch(e => console.error("[placing timeout]", e)); }, PLACING_MS);
  }

  private static readonly MAX_DURATION_MS = 2 * 60 * 60 * 1000; // 2 heures

  start() {
    if (this.timer) return;
    this.status = "ACTIVE";
    this.maxDurationTimer = setTimeout(() => {
      console.log(`[game ${this.id}] 2h timeout — forcing game over`);
      void this.finalizeGame(null);
    }, GameInstance.MAX_DURATION_MS);
    this.timer = setInterval(() => {
      try {
        applyProduction({
          players: this.players,
          tileOwners: this.tileOwners,
          tileBuildings: this.tileBuildings,
          tileTypes: this.tileTypes,
          width: this.width,
          height: this.height
        });
        const now = Date.now();
        for (const [i, e] of this.brouillageTiles) {
          if (e.expiresAt <= now) this.brouillageTiles.delete(i);
        }
        this.onResourceTick?.(this.players.map((p) => ({ id: p.id, resources: p.resources })));

        // Tick galions toutes les 2 secondes
        this.galleonTickCounter++;
        if (this.galleonTickCounter % 2 === 0 && this.galleons.length > 0) {
          const { fires } = this.tickGalleons();
          this.onGalleonUpdate?.(this.galleons, fires);
        }
      } catch (err) {
        console.error("[production tick]", err);
      }
    }, 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.placingTimer) clearTimeout(this.placingTimer);
    this.placingTimer = null;
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    this.maxDurationTimer = null;
    for (const t of this.wonderTimers.values()) clearTimeout(t);
    this.wonderTimers.clear();
    this.wonders = [];
    for (const bot of this.bots) bot.stop();
    this.bots = [];
  }

  private async handlePlacingTimeout() {
    if (this.status !== "PLACING") return;

    // Mark unchosen players as eliminated — they missed the window
    for (const p of this.players) {
      if (!p.hasChosenStart) p.eliminated = true;
    }

    const chosen = this.players.filter((p) => p.hasChosenStart);

    if (chosen.length === 0) {
      this.status = "FINISHED" as any;
      void this.finalizeGame(null);
      return;
    }

    this.start();
    void prisma.game.update({ where: { id: this.id }, data: { status: "ACTIVE" } });
    this.onPlacingTimeout?.();

    if (chosen.length === 1) {
      void this.finalizeGame(chosen[0]!);
    }
  }

  // ── Elimination & win condition ───────────────────────────────────────────

  private doEliminate(playerId: string): TileChange[] {
    const player = this.players.find((p) => p.id === playerId)!;
    player.eliminated = true;
    player.resources = { villagers: 0, soldiers: 0, wood: 0, stone: 0 };
    this._buildingCounts.delete(playerId);

    const changes: TileChange[] = [];
    const ownedTiles = this._tilesByPlayer.get(playerId) ?? new Set<number>();
    for (const i of ownedTiles) {
      this.tileOwners[i] = null;
      this.tileBuildings[i] = null;
      changes.push({ x: i % this.width, y: Math.floor(i / this.width), owner: null, building: null });
    }
    this._tilesByPlayer.delete(playerId);

    this.onPlayerEliminated?.(playerId, changes);
    this.checkGameOver();
    return changes;
  }

  private checkGameOver() {
    const alive = this.players.filter((p) => p.hasChosenStart && !p.eliminated);
    // If all remaining players are bots, stop the game immediately — no point continuing without humans.
    if (alive.length > 1 && alive.every((p) => p.isBot)) {
      void this.finalizeGame(null);
      return;
    }
    if (alive.length > 1) return;

    void this.finalizeGame(alive[0] ?? null);
  }

  private checkEliminationOf(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.eliminated || !player.hasChosenStart) return;
    if (this.tileCount(playerId) === 0) {
      this.doEliminate(playerId);
    }
  }

  // Centralise la fin de partie : DB, stats ELO/grades, callback
  private async finalizeGame(winner: RuntimePlayer | null) {
    this.stop();
    await prisma.game.update({ where: { id: this.id }, data: { status: "FINISHED" } });

    if (this.gameType === "quick") {
      const humans = this.players.filter(p => p.hasChosenStart && !p.isBot);
      if (humans.length > 0) {
        // Incrémenter quickGamesPlayed pour tous les humains
        await prisma.user.updateMany({
          where: { id: { in: humans.map(p => p.userId) } },
          data: { quickGamesPlayed: { increment: 1 } }
        });

        const humanWinner = winner && !winner.isBot ? winner : null;

        if (humanWinner) {
          // Incrémenter les victoires du gagnant humain
          await prisma.user.update({
            where: { id: humanWinner.userId },
            data: { quickGameWins: { increment: 1 } }
          });
        }

        // ELO uniquement si 2+ humains ont participé et qu'un humain a gagné
        if (humanWinner && humans.length >= 2) {
          const humanLosers = humans.filter(p => p.userId !== humanWinner.userId);
          const userElos = await prisma.user.findMany({
            where: { id: { in: humans.map(p => p.userId) } },
            select: { id: true, elo: true }
          });
          const eloMap = Object.fromEntries(userElos.map(u => [u.id, u.elo]));
          const winnerElo = eloMap[humanWinner.userId] ?? 1000;
          const loserElos  = humanLosers.map(p => eloMap[p.userId] ?? 1000);
          const { winnerDelta, loserDeltas } = computeEloUpdates(winnerElo, loserElos);

          await prisma.user.update({
            where: { id: humanWinner.userId },
            data: { elo: winnerElo + winnerDelta }
          });
          for (let i = 0; i < humanLosers.length; i++) {
            const newElo = Math.max(100, loserElos[i]! + loserDeltas[i]!);
            await prisma.user.update({
              where: { id: humanLosers[i]!.userId },
              data: { elo: newElo }
            });
          }
        }
      }
    }

    this.onGameOver?.(winner);
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
      brouillage,
      galleons: this.galleons
    };
  }

  injectBotPlayer(config: { id: string; userId: string; name: string; color: string; civilization: CivilizationId }) {
    const player: RuntimePlayer = {
      id: config.id,
      userId: config.userId,
      name: config.name,
      color: config.color,
      civilization: config.civilization,
      isReady: true,
      hasChosenStart: false,
      basePosition: null,
      resources: { villagers: 0, soldiers: 0, wood: 0, stone: 0 },
      techs: [],
      desiredSoldierPct: 30,
      isBot: true
    };
    this.players.push(player);
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
    this._addTile(player.id, index);
    this._addBuilding(player.id, BuildingType.Base);

    if (!player.isBot) {
      void prisma.gamePlayer.update({
        where: { id: player.id },
        data: { hasChosenStart: true, baseX: pos.x, baseY: pos.y }
      });
    }

    if (this.players.every((p) => p.hasChosenStart)) {
      this.start();
      void prisma.game.update({ where: { id: this.id }, data: { status: "ACTIVE" } });
      this.onGameStart?.();
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
    if (tileType !== TileType.Plain) throw new Error("invalid_tile");
    if (this.tileOwners[index]) throw new Error("already_owned");

    const neighborOwned = orthogonalNeighbors(pos).some((n) => {
      if (!inBounds(n, this.width, this.height)) return false;
      return this.tileOwners[idx(n, this.width)] === player.id;
    });
    if (!neighborOwned) throw new Error("not_adjacent");

    if (player.resources.villagers < 1) throw new Error("not_enough_habitants");
    player.resources.villagers -= 1;

    this.tileOwners[index] = player.id;
    this._addTile(player.id, index);
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

  attackTile(userId: string, pos: Vec2): { change: TileChange; defenderId: string; wonders: Array<{ playerId: string; endsAt: number }> } {
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

    // ── Pertes lors de l'attaque ─────────────────────────────────────────────
    // La résistance est basée sur les SOLDATS par case (les villageois ne se battent pas).
    // Un attaquant nettement supérieur en nombre perd bien moins que le défenseur.
    // Quand le défenseur n'a plus de soldats, ses cases coûtent 1 soldat à capturer (balayage).

    const COMBAT_SCALE = 3; // facteur ×3 par rapport à l'ancienne formule → combats plus décisifs

    const defTiles = this.tileCount(defender.id);
    const defSoldiers = defender.resources.soldiers;

    // Densité militaire du défenseur (soldats/case)
    const defDensity = defTiles > 0 ? defSoldiers / defTiles : 0;

    // Pertes brutes : proportionnelles à la densité × échelle combat
    const defRawLoss = Math.max(1, Math.ceil(defDensity * COMBAT_SCALE));
    const defTotalLoss = defTechs.has("cote_de_maille")
      ? Math.max(1, Math.floor(defRawLoss / 2))
      : defRawLoss;

    // Les soldats absorbent les pertes en priorité — les villageois ne font pas bouclier
    const defSoldierLoss = Math.min(defSoldiers, defTotalLoss);
    const defVillagerLoss = Math.max(0, defTotalLoss - defSoldierLoss);

    // Avantage numérique : l'attaquant 20× plus fort perd ~3× moins que le défenseur
    const numericalAdvantage = Math.min(10, Math.max(1, player.resources.soldiers / Math.max(1, defSoldiers)));
    const atkRawLoss = Math.max(1, Math.ceil(defTotalLoss / Math.sqrt(numericalAdvantage)));
    const atkSoldierLoss = atkTechs.has("epee_longue")
      ? Math.max(1, Math.floor(atkRawLoss / 2))
      : atkRawLoss;

    if (player.resources.soldiers < atkSoldierLoss) throw new Error("not_enough_soldiers");

    defender.resources.soldiers  = Math.max(0, defender.resources.soldiers  - defSoldierLoss);
    defender.resources.villagers = Math.max(0, defender.resources.villagers - defVillagerLoss);
    player.resources.soldiers    = Math.max(0, player.resources.soldiers    - atkSoldierLoss);

    // La case est toujours prise — mettre à jour le cache bâtiments si besoin
    const capturedBuilding = this.tileBuildings[index];
    if (capturedBuilding != null) {
      this._removeBuilding(defender.id, capturedBuilding);

      if (capturedBuilding === BuildingType.Mine || capturedBuilding === BuildingType.Sawmill) {
        // Bâtiments de production détruits à la capture (défenseur perd la production,
        // attaquant reçoit une case vide — symétrie avec la perte des bateaux)
        this.tileBuildings[index] = null;
      } else {
        // Tous les autres bâtiments (caserne, université, port…) passent à l'attaquant
        this._addBuilding(player.id, capturedBuilding);

        if (capturedBuilding === BuildingType.FishingHut) {
          const portK = `${index % this.width}_${Math.floor(index / this.width)}`;
          const pfb = (defender as any).portFishingBoats as Record<string, number> | undefined;
          if (pfb) delete pfb[portK];
          // Remove galleons belonging to this port
          this.galleons = this.galleons.filter(g => !(g.playerId === defender.id && g.portKey === portK));
          const remainingPorts = this.buildingCount(defender.id, BuildingType.FishingHut);
          (defender as any).maritimeCharges = remainingPorts > 0
            ? (defender as any).maritimeCharges ?? 0
            : 0;
        }
      }
    }
    this._removeTile(defender.id, index);
    this._addTile(player.id, index);
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

    const cost = buildCost(intent.building, this.buildingCount(player.id, intent.building));
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
        if (this.status === "ACTIVE" && this.tileOwners[tileIndex] === player.id) {
          void this.finalizeGame(player);
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

    techs.add(techId);
    (player as any).techs = Array.from(techs);
  }

  // ── Port : bateaux ────────────────────────────────────────────────────────

  private hasPort(playerId: string): boolean {
    return this.hasBuilding(playerId, BuildingType.FishingHut);
  }

  buyFishingBoat(userId: string, portPos: Vec2) {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    const portIdx = idx(portPos, this.width);
    if (this.tileBuildings[portIdx] !== BuildingType.FishingHut || this.tileOwners[portIdx] !== player.id)
      throw new Error("invalid_port");
    const portK = `${portPos.x}_${portPos.y}`;
    const pfb: Record<string, number> = (player as any).portFishingBoats ?? {};
    if ((pfb[portK] ?? 0) >= 3) throw new Error("max_boats_reached");
    if (player.resources.villagers < 1) throw new Error("not_enough_habitants");
    if (player.resources.wood < 5) throw new Error("not_enough_resources");
    player.resources.villagers -= 1;
    player.resources.wood -= 5;
    pfb[portK] = (pfb[portK] ?? 0) + 1;
    (player as any).portFishingBoats = pfb;
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

  buyGalleon(userId: string, portPos: Vec2): GalleonState {
    if (this.status !== "ACTIVE") throw new Error("not_active");
    const player = this.getPlayerByUserId(userId);
    if (!player) throw new Error("not_in_game");
    const portIdx = idx(portPos, this.width);
    if (this.tileBuildings[portIdx] !== BuildingType.FishingHut || this.tileOwners[portIdx] !== player.id)
      throw new Error("invalid_port");
    const portK = `${portPos.x}_${portPos.y}`;
    const portGalleons = this.galleons.filter(g => g.playerId === player.id && g.portKey === portK).length;
    if (portGalleons >= GALLEON_MAX_PER_PORT) throw new Error("max_galleons_reached");
    if (player.resources.wood < GALLEON_COST.wood) throw new Error("not_enough_resources");
    if (player.resources.stone < GALLEON_COST.stone) throw new Error("not_enough_resources");

    const spawnPos = this.findGalleonSpawnPos(portPos);
    if (!spawnPos) throw new Error("no_water_adjacent_to_port");

    player.resources.wood  -= GALLEON_COST.wood;
    player.resources.stone -= GALLEON_COST.stone;

    const galleon: GalleonState = {
      id: `${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      portKey: portK,
      x: spawnPos.x,
      y: spawnPos.y,
      hp: GALLEON_HP
    };
    this.galleons.push(galleon);
    return galleon;
  }

  private findGalleonSpawnPos(portPos: Vec2): Vec2 | null {
    for (const n of orthogonalNeighbors(portPos).filter(n => inBounds(n, this.width, this.height))) {
      const ni = idx(n, this.width);
      if ((this.tileTypes[ni] as TileType) === TileType.Water) {
        const occupied = this.galleons.some(g => g.x === n.x && g.y === n.y);
        if (!occupied) return n;
      }
    }
    return null;
  }

  private waterBFS(from: Vec2, to: Vec2): Vec2 | null {
    if (from.x === to.x && from.y === to.y) return null;
    const visited = new Set<number>();
    const queue: Array<{ pos: Vec2; first: Vec2 | null }> = [{ pos: from, first: null }];
    visited.add(idx(from, this.width));

    while (queue.length > 0) {
      const { pos, first } = queue.shift()!;
      for (const n of orthogonalNeighbors(pos)) {
        if (!inBounds(n, this.width, this.height)) continue;
        const ni = idx(n, this.width);
        if (visited.has(ni)) continue;
        visited.add(ni);
        const step = first ?? n;
        if (n.x === to.x && n.y === to.y) return step;
        if ((this.tileTypes[ni] as TileType) === TileType.Water) {
          queue.push({ pos: n, first: step });
        }
      }
    }
    return null;
  }

  private findGalleonTarget(galleon: GalleonState): Vec2 | null {
    let nearest: Vec2 | null = null;
    let nearestDist = Infinity;

    for (const g of this.galleons) {
      if (g.playerId === galleon.playerId) continue;
      const dist = Math.hypot(g.x - galleon.x, g.y - galleon.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = { x: g.x, y: g.y }; }
    }

    for (let i = 0; i < this.tileBuildings.length; i++) {
      if (this.tileBuildings[i] !== BuildingType.FishingHut) continue;
      const owner = this.tileOwners[i];
      if (!owner || owner === galleon.playerId) continue;
      const portPos = { x: i % this.width, y: Math.floor(i / this.width) };
      for (const n of orthogonalNeighbors(portPos).filter(n => inBounds(n, this.width, this.height))) {
        const ni = idx(n, this.width);
        if ((this.tileTypes[ni] as TileType) !== TileType.Water) continue;
        const dist = Math.hypot(n.x - galleon.x, n.y - galleon.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = { x: n.x, y: n.y }; }
      }
    }

    return nearest;
  }

  tickGalleons(): { fires: Array<{ from: Vec2; to: Vec2 }> } {
    const fires: Array<{ from: Vec2; to: Vec2 }> = [];
    const toDestroy = new Set<string>();

    for (const galleon of this.galleons) {
      if (toDestroy.has(galleon.id)) continue;

      let attacked = false;

      // Attack enemy galleons in range
      for (const enemy of this.galleons) {
        if (enemy.playerId === galleon.playerId || toDestroy.has(enemy.id)) continue;
        if (Math.hypot(enemy.x - galleon.x, enemy.y - galleon.y) <= GALLEON_ATTACK_RANGE) {
          fires.push({ from: { x: galleon.x, y: galleon.y }, to: { x: enemy.x, y: enemy.y } });
          enemy.hp--;
          if (enemy.hp <= 0) toDestroy.add(enemy.id);
          attacked = true;
          break;
        }
      }

      // Attack enemy fishing boats in range
      if (!attacked) {
        for (let i = 0; i < this.tileBuildings.length; i++) {
          if (this.tileBuildings[i] !== BuildingType.FishingHut) continue;
          const owner = this.tileOwners[i];
          if (!owner || owner === galleon.playerId) continue;
          const portPos = { x: i % this.width, y: Math.floor(i / this.width) };
          if (Math.hypot(portPos.x - galleon.x, portPos.y - galleon.y) <= GALLEON_ATTACK_RANGE) {
            fires.push({ from: { x: galleon.x, y: galleon.y }, to: portPos });
            const targetPlayer = this.players.find(p => p.id === owner);
            if (targetPlayer && (targetPlayer.fishingBoats ?? 0) > 0) {
              targetPlayer.fishingBoats = (targetPlayer.fishingBoats ?? 0) - 1;
            }
            attacked = true;
            break;
          }
        }
      }

      // Move toward nearest target
      const target = this.findGalleonTarget(galleon);
      if (target) {
        const next = this.waterBFS({ x: galleon.x, y: galleon.y }, target);
        if (next) {
          const blocked = this.galleons.some(g => g.id !== galleon.id && g.x === next.x && g.y === next.y);
          if (!blocked) { galleon.x = next.x; galleon.y = next.y; }
        }
      }
    }

    this.galleons = this.galleons.filter(g => !toDestroy.has(g.id));
    return { fires };
  }

  // Débarquement maritime : case côtière neutre (settler) ou ennemie (assaut)
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
    const existingOwner = this.tileOwners[index];
    if (existingOwner === player.id) throw new Error("already_own");

    const adjToWater = orthogonalNeighbors(pos).some(n => {
      if (!inBounds(n, this.width, this.height)) return false;
      return (this.tileTypes[idx(n, this.width)] as TileType) === TileType.Water;
    });
    if (!adjToWater) throw new Error("needs_adjacent_water");

    if (existingOwner) {
      // ── Assaut maritime sur territoire ennemi ─────────────────────────────
      if (player.resources.soldiers < 1) throw new Error("not_enough_soldiers");

      const defender = this.players.find(p => p.id === existingOwner)!;
      const atkTechs = new Set(player.techs ?? []);
      const defTechs = new Set(defender.techs ?? []);

      const COMBAT_SCALE = 3;
      const defTiles = this.tileCount(defender.id);
      const defSoldiers = defender.resources.soldiers;
      const defDensity = defTiles > 0 ? defSoldiers / defTiles : 0;
      const defRawLoss  = Math.max(1, Math.ceil(defDensity * COMBAT_SCALE));
      const defTotalLoss = defTechs.has("cote_de_maille")
        ? Math.max(1, Math.floor(defRawLoss / 2)) : defRawLoss;

      const defSoldierLoss  = Math.min(defSoldiers, defTotalLoss);
      const defVillagerLoss = Math.max(0, defTotalLoss - defSoldierLoss);

      const numericalAdvantage = Math.min(10, Math.max(1, player.resources.soldiers / Math.max(1, defSoldiers)));
      const atkRawLoss    = Math.max(1, Math.ceil(defTotalLoss / Math.sqrt(numericalAdvantage)));
      const atkSoldierLoss = atkTechs.has("epee_longue")
        ? Math.max(1, Math.floor(atkRawLoss / 2)) : atkRawLoss;

      if (player.resources.soldiers < atkSoldierLoss) throw new Error("not_enough_soldiers");

      defender.resources.soldiers  = Math.max(0, defender.resources.soldiers  - defSoldierLoss);
      defender.resources.villagers = Math.max(0, defender.resources.villagers - defVillagerLoss);
      player.resources.soldiers    = Math.max(0, player.resources.soldiers    - atkSoldierLoss);

      // Bâtiment capturé (mines/scieries détruites, autres transférés)
      const capturedBuilding = this.tileBuildings[index];
      if (capturedBuilding != null) {
        this._removeBuilding(defender.id, capturedBuilding);
        if (capturedBuilding === BuildingType.Mine || capturedBuilding === BuildingType.Sawmill) {
          this.tileBuildings[index] = null;
        } else {
          this._addBuilding(player.id, capturedBuilding);
        }
      }

      // Annuler merveille si applicable
      const wi = this.wonders.findIndex(w => w.tileIndex === index && w.playerId === defender.id);
      if (wi !== -1) this.wonders.splice(wi, 1);

    } else {
      // ── Débarquement sur case neutre (settlers) ───────────────────────────
      if (player.resources.villagers < 1) throw new Error("not_enough_habitants");
      player.resources.villagers -= 1;
    }

    if (existingOwner) this._removeTile(existingOwner, index);
    this._addTile(player.id, index);
    player.maritimeCharges = charges - 1;
    this.tileOwners[index] = player.id;
    return { x: pos.x, y: pos.y, owner: player.id, building: this.tileBuildings[index] ?? null };
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
