import { defineStore } from "pinia";
import type { BrouillagePatchEvent, GameOverEvent, GameStateSnapshot, PlayerEliminatedEvent, PlayerUpdateEvent, ResourceUpdateEvent, TileUpdateEvent, Vec2 } from "../types/game";
import { BuildingType, TileType } from "../types/game";
import { getSocket } from "../composables/useSocket";
import { useAuthStore } from "./authStore";
import { tileIndex } from "../utils/tileUtils";

// Module-level cooldowns — not reactive, no overhead
let _lastAttackEmit = 0;

// Hex neighbor offsets for even-r offset grid (matches backend orthogonalNeighbors)
function hexNeighborOffsets(row: number): [number, number][] {
  return row % 2 === 0
    ? [[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]]
    : [[1,-1],[1,0],[1,1],[0,1],[-1,0],[0,-1]];
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
            if (p.maritimeCharges !== undefined) player.maritimeCharges = p.maritimeCharges;
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

    async buyFishingBoat(gameId: string) {
      const socket = await getSocket();
      socket.emit("game:buy_fishing_boat", { gameId });
    },

    async buyTransportBoat(gameId: string) {
      const socket = await getSocket();
      socket.emit("game:buy_transport_boat", { gameId });
    },

    async maritimeLand(gameId: string, pos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:maritime_land", { gameId, x: pos.x, y: pos.y });
      this.maritimeLandingMode = false;
    },

    selectBuilding(building: BuildingType | null) {
      this.selectedBuilding = building;
      this.maritimeLandingMode = false;
    },

    toggleMaritimeLanding() {
      this.maritimeLandingMode = !this.maritimeLandingMode;
      if (this.maritimeLandingMode) this.selectedBuilding = null;
    },

    // Clic GAUCHE — toutes les actions : choisir base, claim, attaque, build
    async onTileClick(pos: Vec2) {
      if (!this.state) return;
      if (this.state.status === "PLACING") return this.chooseStart(this.state.gameId, pos);
      if (this.state.status !== "ACTIVE") return;
      if (this.maritimeLandingMode) return this.maritimeLand(this.state.gameId, pos);

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

      // Case neutre : débarquement automatique si conditions réunies, sinon claim
      const neighbors = hexNeighborOffsets(pos.y)
        .map(([dc, dr]) => ({ x: pos.x + dc, y: pos.y + dr }))
        .filter(n => n.x >= 0 && n.y >= 0 && n.x < this.state!.width && n.y < this.state!.height);
      const adjToMe    = neighbors.some(n => this.state!.tiles.owners[n.y * this.state!.width + n.x] === meId);
      const adjToWater = neighbors.some(n => (this.state!.tiles.types[n.y * this.state!.width + n.x] as TileType) === TileType.Water);
      const charges    = (this.mePlayer as any)?.maritimeCharges ?? 0;
      if (!adjToMe && adjToWater && charges > 0) return this.maritimeLand(this.state.gameId, pos);
      return this.claimTile(this.state.gameId, pos);
    },

    // Clic DROIT — menu radial contextuel (uniquement sur ses propres cases vides)
    onTileContext(pos: Vec2, clientX: number, clientY: number) {
      if (!this.state || this.state.status !== "ACTIVE") return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      if (this.state.tiles.owners[i] !== meId) return;
      if ((this.state.tiles.types[i] as TileType) !== TileType.Plain) return;
      if (this.state.tiles.buildings[i] !== null) return;
      this.radialMenu = { tile: pos, clientX, clientY };
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

      // Attaquer en bloc : toutes les tuiles dans un rayon de 6 cases autour de la plus proche
      const closest = frontier[0]!;
      const closestDist = Math.sqrt((closest.x - target.x) ** 2 + (closest.y - target.y) ** 2);
      const bandMax = (closestDist + 6) ** 2;
      const band = frontier.filter(t => (t.x - target.x) ** 2 + (t.y - target.y) ** 2 <= bandMax);
      band.sort(() => Math.random() - 0.5);
      // Limiter par soldats disponibles (prudent)
      const attackCount = Math.min(3, band.length, Math.max(1, Math.floor(mySoldiers / 10)));
      for (const pos of band.slice(0, attackCount)) {
        void this.attackTile(state.gameId, pos);
      }
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

      // Prendre toutes les tuiles dans un rayon de 8 cases autour de la plus proche
      // → forme un bloc large plutôt qu'une ligne droite
      const closest = frontier[0]!;
      const closestDist = Math.sqrt((closest.x - target.x) ** 2 + (closest.y - target.y) ** 2);
      const bandMax = (closestDist + 8) ** 2;
      const band = frontier.filter(t => (t.x - target.x) ** 2 + (t.y - target.y) ** 2 <= bandMax);
      // Mélanger pour éviter de toujours prendre le même côté
      band.sort(() => Math.random() - 0.5);
      const batch = band.slice(0, Math.min(5, myVillagers));
      void this.claimTiles(state.gameId, batch);
    }
  }
});
