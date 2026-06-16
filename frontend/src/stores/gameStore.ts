import { defineStore } from "pinia";
import type { BrouillagePatchEvent, GameOverEvent, GalleonState, LandUnitState, LandUnitsUpdateEvent, CatapultFireEvent, GameStateSnapshot, PlayerEliminatedEvent, PlayerUpdateEvent, ResourceUpdateEvent, TileUpdateEvent, Vec2 } from "../types/game";
import { BuildingType, TileType } from "../types/game";
import { getSocket } from "../composables/useSocket";
import { useAuthStore } from "./authStore";
import { tileIndex } from "../utils/tileUtils";
import { findWaterPath } from "../utils/waterPath";

// Module-level cooldowns — not reactive, no overhead
let _lastAttackEmit = 0;

// Boat animation intervals — keyed by animId
const _boatIntervals = new Map<string, number>();
const BOAT_STEP_MS   = 350; // ms per water tile — intentionally slow

// Hex neighbor offsets — pre-allocated constants (no allocation per call)
const HEX_OFFSETS_EVEN: readonly [number, number][] = [[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]];
const HEX_OFFSETS_ODD:  readonly [number, number][] = [[1,-1],[1,0],[1,1],[0,1],[-1,0],[0,-1]];
function hexNeighborOffsets(row: number): readonly [number, number][] {
  return row % 2 === 0 ? HEX_OFFSETS_EVEN : HEX_OFFSETS_ODD;
}

function inBounds(pos: Vec2, state: GameStateSnapshot) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.width && pos.y < state.height;
}

function canClaimOptimistic(state: GameStateSnapshot, playerId: string, pos: Vec2) {
  if (!inBounds(pos, state)) return false;
  const i = tileIndex(pos.x, pos.y, state.width);
  if ((state.tiles.types[i] as TileType) !== TileType.Plain) return false;
  return hexNeighborOffsets(pos.y).some(([dc, dr]) => {
    const n = { x: pos.x + dc, y: pos.y + dr };
    return inBounds(n, state) && state.tiles.owners[tileIndex(n.x, n.y, state.width)] === playerId;
  });
}

export const useGameStore = defineStore("game", {
  state: () => ({
    state: null as GameStateSnapshot | null,
    connected: false,
    socketDisconnected: false,
    lastError: "" as string | null,
    hoveredTile: null as Vec2 | null,
    selectedBuilding: null as BuildingType | null,
    currentGameId: null as string | null,
    optimisticClaims: {} as Record<string, true>,
    gameOver: null as GameOverEvent | null,
    expandTarget: null as Vec2 | null,
    _expandIntervalId: null as number | null,
    maritimeLandingMode: false,
    attackTarget: null as Vec2 | null,
    _attackIntervalId: null as number | null,
    attackWarnings: [] as Array<{ x: number; y: number; expiresAt: number }>,
    radialMenu: null as { tile: Vec2; clientX: number; clientY: number } | null,
    portMenu: null as { tile: Vec2; clientX: number; clientY: number } | null,
    maritimeMenu: null as { tile: Vec2; clientX: number; clientY: number } | null,
    maritimeAnimations: [] as Array<{ id: string; path: Vec2[]; step: number; isOwn: boolean; gameId: string; targetPos: Vec2 }>,
    galleons: [] as GalleonState[],
    cannonballs: [] as Array<{ id: string; from: Vec2; to: Vec2; startedAt: number }>,
    landUnits: [] as LandUnitState[],
    catapultFlashes: [] as Array<{ center: Vec2; startedAt: number }>,
    barracksMenu: null as { tile: Vec2; clientX: number; clientY: number } | null,
    forestMenu: null as { tile: Vec2; clientX: number; clientY: number } | null,
    catapultTargetingMode: false,
    catapultTile: null as Vec2 | null,
    catapultCooldownEnds: 0,
    stateRevision: 0   // incremented on every mutation — watched instead of deep state
  }),
  getters: {
    mePlayer(state) {
      const auth = useAuthStore();
      return state.state?.players.find((p) => p.userId === auth.user?.id) ?? null;
    }
  },
  actions: {
    async connect(_gameId: string) {
      if (this.connected) return;
      const socket = await getSocket();

      // Full snapshot — used on initial join and after special actions (start, tech, brouillage)
      socket.on("game:state", (snapshot: GameStateSnapshot) => {
        this.state = snapshot;
        this.galleons = snapshot.galleons ?? [];
        this.landUnits = snapshot.landUnits ?? [];
        this.currentGameId = snapshot.gameId;
        this.optimisticClaims = {};
        if (snapshot.status !== "FINISHED") this.gameOver = null;
        this.stateRevision++;
      });

      // Lightweight tile patch — immediate result of claim/attack/build
      socket.on("game:tile_update", (event: TileUpdateEvent) => {
        if (!this.state) return;
        const myId = this.mePlayer?.id;
        const now = Date.now();
        for (const ch of event.changes) {
          const i = tileIndex(ch.x, ch.y, this.state.width);
          if (myId && this.state.tiles.owners[i] === myId && ch.owner !== myId) {
            this.attackWarnings.push({ x: ch.x, y: ch.y, expiresAt: now + 3000 });
          }
          this.state.tiles.owners[i]    = ch.owner;
          this.state.tiles.buildings[i] = ch.building;
          delete this.optimisticClaims[`${ch.x},${ch.y}`];
        }
        for (const p of event.players) {
          const player = this.state.players.find((pl) => pl.id === p.id);
          if (player) {
            player.resources = p.resources;
            if (p.maritimeCharges   !== undefined) player.maritimeCharges   = p.maritimeCharges;
            if (p.portFishingBoats  !== undefined) player.portFishingBoats  = p.portFishingBoats;
            if (p.portTransports    !== undefined) player.portTransports    = p.portTransports;
            if ((p as any).cursedForestCooldownEnds !== undefined) (player as any).cursedForestCooldownEnds = (p as any).cursedForestCooldownEnds;
          }
        }
        if (event.wonders !== undefined) this.state.wonders = event.wonders;
        this.attackWarnings = this.attackWarnings.filter(w => w.expiresAt > now);
        this.stateRevision++;
      });

      // Resource-only patch — from the 1s production tick
      socket.on("game:resources_update", (event: ResourceUpdateEvent) => {
        if (!this.state) return;
        for (const p of event.players) {
          const player = this.state.players.find((pl) => pl.id === p.id);
          if (player) player.resources = p.resources;
        }
        this.stateRevision++;
      });

      socket.on("game:player_update", (event: PlayerUpdateEvent) => {
        if (!this.state) return;
        const player = this.state.players.find((pl) => pl.id === event.player.id);
        if (player) Object.assign(player, event.player);
        this.stateRevision++;
      });

      socket.on("game:maritime_animation", (event: { animId: string; path: Vec2[] }) => {
        if (!this.currentGameId) return;
        const targetPos = event.path[event.path.length - 1] ?? { x: 0, y: 0 };
        this._startBoatAnimation(event.animId, event.path, this.currentGameId, false, targetPos);
      });

      socket.on("game:land_units_update", (event: LandUnitsUpdateEvent) => {
        if (this.state) this.state.landUnits = event.units;
        this.landUnits = event.units;
        this.stateRevision++;
      });

      socket.on("game:catapult_fire", (event: CatapultFireEvent & { cooldownEnds?: number; isMe?: boolean }) => {
        if (!this.state) return;
        this.catapultFlashes.push({ center: event.center, startedAt: Date.now() });
        const now = Date.now();
        this.catapultFlashes = this.catapultFlashes.filter(f => now - f.startedAt < 3000);
        if (event.cooldownEnds) this.catapultCooldownEnds = event.cooldownEnds;
        for (const ch of event.changes) {
          const i = tileIndex(ch.x, ch.y, this.state.width);
          this.state.tiles.owners[i] = ch.owner;
          this.state.tiles.buildings[i] = ch.building;
        }
        this.stateRevision++;
      });

      socket.on("game:galleons_update", (event: { galleons: GalleonState[]; fires: Array<{ from: Vec2; to: Vec2 }> }) => {
        if (this.state) this.state.galleons = event.galleons;
        this.galleons = event.galleons;
        for (const fire of event.fires) {
          const id = `cb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          this.cannonballs.push({ id, from: fire.from, to: fire.to, startedAt: Date.now() });
        }
        // Clean cannonballs older than 1.5s
        const now = Date.now();
        this.cannonballs = this.cannonballs.filter(c => now - c.startedAt < 1500);
        this.stateRevision++;
      });

      socket.on("game:brouillage_patch", (event: BrouillagePatchEvent) => {
        if (!this.state) return;
        const now = Date.now();
        this.state.brouillage = [
          ...this.state.brouillage.filter(b => b.expiresAt > now),
          ...event.added
        ];
        this.stateRevision++;
      });

      socket.on("game:player_eliminated", (event: PlayerEliminatedEvent) => {
        if (!this.state) return;
        for (const ch of event.changes) {
          const i = tileIndex(ch.x, ch.y, this.state.width);
          this.state.tiles.owners[i]    = null;
          this.state.tiles.buildings[i] = null;
        }
        const player = this.state.players.find((p) => p.id === event.playerId);
        if (player) {
          player.eliminated = true;
          player.resources  = { villagers: 0, soldiers: 0, wood: 0, stone: 0 };
        }
        this.stateRevision++;
      });

      socket.on("game:over", (event: GameOverEvent) => {
        this.gameOver = event;
        if (this.state) this.state.status = "FINISHED";
      });

      socket.on("game:error", ({ error }: { error: string }) => {
        this.lastError = error;
      });

      socket.on("disconnect", () => {
        this.socketDisconnected = true;
      });

      socket.on("connect", () => {
        this.socketDisconnected = false;
        // Resync l'état du jeu après reconnexion
        if (this.currentGameId) {
          socket.emit("game:get_state", { gameId: this.currentGameId });
        }
      });

      this.connected = true;
    },

    async getState(gameId: string) {
      const socket = await getSocket();
      if (this.currentGameId && this.currentGameId !== gameId) {
        socket.emit("game:leave", { gameId: this.currentGameId });
        this.state = null;
        this.selectedBuilding = null;
        this.hoveredTile = null;
        this.optimisticClaims = {};
        this.gameOver = null;
        this.clearExpandTarget();
        // Cancel any running boat animations
        for (const timer of _boatIntervals.values()) clearInterval(timer);
        _boatIntervals.clear();
        this.maritimeAnimations = [];
      }
      socket.emit("game:get_state", { gameId });
    },

    async chooseStart(gameId: string, pos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:choose_start", { gameId, x: pos.x, y: pos.y });
    },

    async claimTile(gameId: string, pos: Vec2) {
      if (!this.state) return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      if ((this.mePlayer?.resources.villagers ?? 0) < 1) return;
      if (!canClaimOptimistic(this.state, meId, pos)) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      if (this.state.tiles.owners[i] != null) return;

      // Optimistic: mark the tile immediately for smooth UX
      this.optimisticClaims[`${pos.x},${pos.y}`] = true;
      const socket = await getSocket();
      socket.emit("game:claim_tile", { gameId, x: pos.x, y: pos.y });
    },

    async claimTiles(gameId: string, tiles: Vec2[]) {
      if (!this.state) return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      let villagersLeft = this.mePlayer?.resources.villagers ?? 0;
      const valid: Vec2[] = [];
      for (const t of tiles) {
        if (villagersLeft < 1) break;
        if (!canClaimOptimistic(this.state, meId, t)) continue;
        villagersLeft--;
        this.optimisticClaims[`${t.x},${t.y}`] = true;
        valid.push(t);
      }
      if (valid.length === 0) return;
      const socket = await getSocket();
      socket.emit("game:claim_tiles", { gameId, tiles: valid });
    },

    async attackTile(gameId: string, pos: Vec2) {
      if (!this.state) return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      if (!inBounds(pos, this.state)) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      if ((this.state.tiles.types[i] as TileType) === TileType.Water) return;
      const owner = this.state.tiles.owners[i];
      if (!owner || owner === meId) return;
      if (!canClaimOptimistic(this.state, meId, pos)) return;

      // Rate-limit: max 1 attack emit per 120ms to avoid flooding
      const now = Date.now();
      if (now - _lastAttackEmit < 120) return;
      _lastAttackEmit = now;

      const socket = await getSocket();
      socket.emit("game:attack_tile", { gameId, x: pos.x, y: pos.y });
    },

    async build(gameId: string, pos: Vec2, building: BuildingType) {
      const socket = await getSocket();
      socket.emit("game:build", { gameId, x: pos.x, y: pos.y, building });
    },

    async setComposition(gameId: string, soldiers: number) {
      const socket = await getSocket();
      socket.emit("game:set_composition", { gameId, soldierPct: soldiers });
    },

    setHovered(pos: Vec2 | null) {
      this.hoveredTile = pos;
    },

    async buyFishingBoat(gameId: string, portPos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:buy_fishing_boat", { gameId, portX: portPos.x, portY: portPos.y });
    },

    async buyTransportBoat(gameId: string, portPos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:buy_transport_boat", { gameId, portX: portPos.x, portY: portPos.y });
    },

    async buyGalleon(gameId: string, portPos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:buy_galleon", { gameId, portX: portPos.x, portY: portPos.y });
    },

    async buyLandUnit(gameId: string, barracksPos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:buy_land_unit", { gameId, barracksX: barracksPos.x, barracksY: barracksPos.y });
    },

    async curseForest(gameId: string, forestPos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:curse_forest", { gameId, x: forestPos.x, y: forestPos.y });
    },

    async fireCatapult(gameId: string, targetPos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:fire_catapult", { gameId, targetX: targetPos.x, targetY: targetPos.y });
    },

    async maritimeLand(gameId: string, pos: Vec2) {
      this.maritimeLandingMode = false;

      // Port le plus proche de la destination (Euclidien)
      let portPos: Vec2 | null = null;
      if (this.state) {
        const meId = this.mePlayer?.id;
        if (meId) {
          let minDist = Infinity;
          for (let i = 0; i < this.state.tiles.buildings.length; i++) {
            if (this.state.tiles.buildings[i] !== BuildingType.FishingHut) continue;
            if (this.state.tiles.owners[i] !== meId) continue;
            const px = i % this.state.width;
            const py = Math.floor(i / this.state.width);
            const d = (px - pos.x) ** 2 + (py - pos.y) ** 2;
            if (d < minDist) { minDist = d; portPos = { x: px, y: py }; }
          }
        }
      }

      const socket = await getSocket();

      if (portPos && this.state) {
        const path = findWaterPath(this.state, portPos, pos);
        if (path && path.length > 2) {
          const animId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          // Broadcast to all other players
          socket.emit("game:maritime_animation", { gameId, animId, path });
          // Start locally as the initiating client
          this._startBoatAnimation(animId, path, gameId, true, pos);
          return;
        }
      }

      socket.emit("game:maritime_land", { gameId, x: pos.x, y: pos.y });
    },

    _startBoatAnimation(animId: string, path: Vec2[], gameId: string, isOwn: boolean, targetPos: Vec2) {
      this.maritimeAnimations.push({ id: animId, path, step: 0, isOwn, gameId, targetPos });
      this.stateRevision++;

      const timer = window.setInterval(async () => {
        const idx = this.maritimeAnimations.findIndex(a => a.id === animId);
        if (idx === -1) { clearInterval(timer); _boatIntervals.delete(animId); return; }
        const anim = this.maritimeAnimations[idx];
        anim.step++;
        this.stateRevision++;
        if (anim.step >= anim.path.length - 1) {
          clearInterval(timer);
          _boatIntervals.delete(animId);
          this.maritimeAnimations.splice(idx, 1);
          if (anim.isOwn) {
            const socket = await getSocket();
            socket.emit("game:maritime_land", { gameId: anim.gameId, x: anim.targetPos.x, y: anim.targetPos.y });
          }
          this.stateRevision++;
        }
      }, BOAT_STEP_MS);
      _boatIntervals.set(animId, timer);
    },

    selectBuilding(building: BuildingType | null) {
      this.selectedBuilding = building;
      this.maritimeLandingMode = false;
    },

    toggleMaritimeLanding() {
      this.maritimeLandingMode = !this.maritimeLandingMode;
      if (this.maritimeLandingMode) this.selectedBuilding = null;
    },

    // Clic GAUCHE — choisir base, claim, attaque, build (plus de maritime par clic gauche)
    async onTileClick(pos: Vec2) {
      if (!this.state) return;
      if (this.state.status === "PLACING") return this.chooseStart(this.state.gameId, pos);
      if (this.state.status !== "ACTIVE") return;

      // Mode ciblage catapulte
      if (this.catapultTargetingMode) {
        this.catapultTargetingMode = false;
        await this.fireCatapult(this.state.gameId, pos);
        return;
      }

      const meId = this.mePlayer?.id;
      if (!meId) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      const owner = this.state.tiles.owners[i];

      if (owner === meId) {
        if (this.selectedBuilding != null) return this.build(this.state.gameId, pos, this.selectedBuilding);
        return;
      }

      if (owner && owner !== meId) {
        const hasBarracks = this.state.tiles.buildings.some(
          (b, j) => this.state!.tiles.owners[j] === meId && b === BuildingType.Barracks
        );
        if (!hasBarracks) return;
        return this.attackTile(this.state.gameId, pos);
      }

      return this.claimTile(this.state.gameId, pos);
    },

    // Clic DROIT — menu contextuel selon la case
    onTileContext(pos: Vec2, clientX: number, clientY: number) {
      if (!this.state || this.state.status !== "ACTIVE") return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      const owner = this.state.tiles.owners[i];

      if (owner === meId) {
        // Port → menu achat bateaux
        if (this.state.tiles.buildings[i] === BuildingType.FishingHut) {
          this.portMenu = { tile: pos, clientX, clientY };
          return;
        }
        // Caserne → menu unités terrestres (Nains / Horde seulement)
        if (this.state.tiles.buildings[i] === BuildingType.Barracks) {
          const civ = this.mePlayer?.civilization;
          if (civ === "iron_dwarves" || civ === "steppe_horde") {
            this.barracksMenu = { tile: pos, clientX, clientY };
            return;
          }
        }
        // Catapulte → mode ciblage (Aurélien seulement)
        if (this.state.tiles.buildings[i] === BuildingType.Catapult) {
          if (this.mePlayer?.civilization === "aurelian_empire") {
            this.catapultTargetingMode = true;
            this.catapultTile = pos;
            return;
          }
        }
        // Case plain vide → menu de construction
        if ((this.state.tiles.types[i] as TileType) === TileType.Plain && this.state.tiles.buildings[i] === null) {
          this.radialMenu = { tile: pos, clientX, clientY };
        }
        return;
      }

      // Forêt maudite : forêt adjacente au territoire de l'elfe (pas besoin de la posséder)
      if (this.mePlayer?.civilization === "sylvan_elves" &&
          (this.state.tiles.types[i] as TileType) === TileType.Forest) {
        const adjacent = hexNeighborOffsets(pos.y).some(([dc, dr]) => {
          const nx = pos.x + dc, ny = pos.y + dr;
          if (nx < 0 || ny < 0 || nx >= this.state!.width || ny >= this.state!.height) return false;
          return this.state!.tiles.owners[ny * this.state!.width + nx] === meId;
        });
        if (adjacent) { this.forestMenu = { tile: pos, clientX, clientY }; return; }
      }

      // Case neutre OU ennemie, plain + adjacent à l'eau + charges dispo → menu débarquement
      if (owner !== meId && (this.state.tiles.types[i] as TileType) === TileType.Plain) {
        const charges = (this.mePlayer as any)?.maritimeCharges ?? 0;
        if (charges > 0) {
          const adjToWater = hexNeighborOffsets(pos.y).some(([dc, dr]) => {
            const nx = pos.x + dc, ny = pos.y + dr;
            if (nx < 0 || ny < 0 || nx >= this.state!.width || ny >= this.state!.height) return false;
            return (this.state!.tiles.types[ny * this.state!.width + nx] as TileType) === TileType.Water;
          });
          if (adjToWater) this.maritimeMenu = { tile: pos, clientX, clientY };
        }
      }
    },

    setExpandTarget(pos: Vec2) {
      // Double-clic sur la même cible = annuler
      if (this.expandTarget?.x === pos.x && this.expandTarget?.y === pos.y) {
        this.clearExpandTarget();
        return;
      }
      this.expandTarget = pos;
      if (this._expandIntervalId === null) {
        this._expandIntervalId = window.setInterval(() => void this.autoExpand(), 800);
      }
      void this.autoExpand();
    },

    clearExpandTarget() {
      this.expandTarget = null;
      if (this._expandIntervalId !== null) {
        window.clearInterval(this._expandIntervalId);
        this._expandIntervalId = null;
      }
    },

    setAttackTarget(pos: Vec2) {
      if (this.attackTarget?.x === pos.x && this.attackTarget?.y === pos.y) {
        this.clearAttackTarget();
        return;
      }
      this.attackTarget = pos;
      if (this._attackIntervalId === null) {
        this._attackIntervalId = window.setInterval(() => void this.autoAttack(), 800);
      }
      void this.autoAttack();
    },

    clearAttackTarget() {
      this.attackTarget = null;
      if (this._attackIntervalId !== null) {
        window.clearInterval(this._attackIntervalId);
        this._attackIntervalId = null;
      }
    },

    // Cached frontiers — rebuilt only when stateRevision changes
    _attackFrontierRev: -1,
    _attackFrontierCache: [] as Vec2[],
    _expandFrontierRev: -1,
    _expandFrontierCache: [] as Vec2[],

    autoAttack() {
      const state = this.state;
      const target = this.attackTarget;
      if (!state || !target || state.status !== "ACTIVE") return;

      const myId = this.mePlayer?.id;
      const mySoldiers = this.mePlayer?.resources.soldiers ?? 0;
      if (!myId || mySoldiers < 1) return;

      if (state.tiles.owners[target.y * state.width + target.x] === myId) {
        this.clearAttackTarget();
        return;
      }

      // Rebuild frontier only if state changed since last call
      if (this._attackFrontierRev !== this.stateRevision) {
        this._attackFrontierRev = this.stateRevision;
        const result: Vec2[] = [];
        for (let i = 0; i < state.tiles.owners.length; i++) {
          const owner = state.tiles.owners[i];
          if (!owner || owner === myId) continue;
          if ((state.tiles.types[i] as TileType) !== TileType.Plain) continue;
          const x = i % state.width;
          const y = Math.floor(i / state.width);
          const adjToMe = hexNeighborOffsets(y).some(([dc, dr]) => {
            const nx = x + dc, ny = y + dr;
            if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) return false;
            return state.tiles.owners[ny * state.width + nx] === myId;
          });
          if (adjToMe) result.push({ x, y });
        }
        this._attackFrontierCache = result;
      }
      const frontier = this._attackFrontierCache;

      if (frontier.length === 0) { this.clearAttackTarget(); return; }

      frontier.sort((a, b) => {
        const da = (a.x - target.x) ** 2 + (a.y - target.y) ** 2;
        const db = (b.x - target.x) ** 2 + (b.y - target.y) ** 2;
        return da - db;
      });

      // Rayon et nombre d'attaques scalent avec les soldats disponibles
      const radius = Math.min(18, 5 + Math.floor(mySoldiers / 20));
      const closest = frontier[0]!;
      const closestDist = Math.sqrt((closest.x - target.x) ** 2 + (closest.y - target.y) ** 2);
      const bandMax = (closestDist + radius) ** 2;
      const band = frontier.filter(t => (t.x - target.x) ** 2 + (t.y - target.y) ** 2 <= bandMax);
      band.sort(() => Math.random() - 0.5);

      // Nombre d'attaques par tick : 3 minimum, ~1 par 5 soldats, cap à 30
      const attackCount = Math.min(band.length, Math.max(3, Math.floor(mySoldiers / 5)), 30);

      // Émettre directement sans rate-limit (le serveur rejette les attaques invalides)
      void (async () => {
        const socket = await getSocket();
        for (const pos of band.slice(0, attackCount)) {
          socket.emit("game:attack_tile", { gameId: state.gameId, x: pos.x, y: pos.y });
        }
      })();
    },

    onTileDblClick(pos: Vec2) {
      if (!this.state || this.state.status !== "ACTIVE") return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      const owner = this.state.tiles.owners[i];
      if (owner && owner !== meId) {
        this.setAttackTarget(pos);
      } else {
        this.setExpandTarget(pos);
      }
    },

    autoExpand() {
      const state = this.state;
      const target = this.expandTarget;
      if (!state || !target || state.status !== "ACTIVE") return;

      const myId = this.mePlayer?.id;
      const myVillagers = this.mePlayer?.resources.villagers ?? 0;
      if (!myId || myVillagers < 1) return;

      // Cible déjà atteinte ?
      if (state.tiles.owners[target.y * state.width + target.x] === myId) {
        this.clearExpandTarget();
        return;
      }

      // Rebuild frontier only if state changed since last call
      if (this._expandFrontierRev !== this.stateRevision) {
        this._expandFrontierRev = this.stateRevision;
        const seen = new Set<number>();
        const result: Vec2[] = [];
        for (let i = 0; i < state.tiles.owners.length; i++) {
          if (state.tiles.owners[i] !== myId) continue;
          const x = i % state.width;
          const y = Math.floor(i / state.width);
          for (const [dc, dr] of hexNeighborOffsets(y)) {
            const nx = x + dc, ny = y + dr;
            if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
            const ni = ny * state.width + nx;
            if (seen.has(ni)) continue;
            seen.add(ni);
            if (state.tiles.owners[ni] === null && (state.tiles.types[ni] as TileType) === TileType.Plain) {
              result.push({ x: nx, y: ny });
            }
          }
        }
        this._expandFrontierCache = result;
      }
      const frontier = this._expandFrontierCache;

      if (frontier.length === 0) { this.clearExpandTarget(); return; }

      frontier.sort((a, b) => {
        const da = (a.x - target.x) ** 2 + (a.y - target.y) ** 2;
        const db = (b.x - target.x) ** 2 + (b.y - target.y) ** 2;
        return da - db;
      });

      // Rayon et nombre de cases scalent avec les villageois disponibles
      const radius = Math.min(14, 6 + Math.floor(myVillagers / 25));
      const closest = frontier[0]!;
      const closestDist = Math.sqrt((closest.x - target.x) ** 2 + (closest.y - target.y) ** 2);
      const bandMax = (closestDist + radius) ** 2;
      const band = frontier.filter(t => (t.x - target.x) ** 2 + (t.y - target.y) ** 2 <= bandMax);
      band.sort(() => Math.random() - 0.5);
      // ~1 case par 6 villageois, min 5, cap 30
      const claimCount = Math.min(band.length, myVillagers, Math.max(5, Math.floor(myVillagers / 6)), 30);
      void this.claimTiles(state.gameId, band.slice(0, claimCount));
    }
  }
});
