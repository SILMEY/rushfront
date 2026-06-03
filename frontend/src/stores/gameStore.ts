import { defineStore } from "pinia";
import type { GameOverEvent, GameStateSnapshot, PlayerEliminatedEvent, ResourceUpdateEvent, TileUpdateEvent, Vec2 } from "../types/game";
import { BuildingType, TileType } from "../types/game";
import { getSocket } from "../composables/useSocket";
import { useAuthStore } from "./authStore";
import { tileIndex } from "../utils/tileUtils";

function inBounds(pos: Vec2, state: GameStateSnapshot) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.width && pos.y < state.height;
}

function canClaimOptimistic(state: GameStateSnapshot, playerId: string, pos: Vec2) {
  if (!inBounds(pos, state)) return false;
  const i = tileIndex(pos.x, pos.y, state.width);
  if ((state.tiles.types[i] as TileType) !== TileType.Plain) return false;
  return [
    { x: pos.x + 1, y: pos.y }, { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 }
  ].some((n) => inBounds(n, state) && state.tiles.owners[tileIndex(n.x, n.y, state.width)] === playerId);
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
    attackWarnings: [] as Array<{ x: number; y: number; expiresAt: number }>
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
      });

      // Lightweight tile patch — immediate result of claim/attack/build
      socket.on("game:tile_update", (event: TileUpdateEvent) => {
        if (!this.state) return;
        const myId = this.mePlayer?.id;
        const now = Date.now();
        for (const ch of event.changes) {
          const i = tileIndex(ch.x, ch.y, this.state.width);
          // Avertissement radar : une de mes cases vient d'être capturée
          if (myId && this.state.tiles.owners[i] === myId && ch.owner !== myId) {
            this.attackWarnings.push({ x: ch.x, y: ch.y, expiresAt: now + 3000 });
          }
          this.state.tiles.owners[i]    = ch.owner;
          this.state.tiles.buildings[i] = ch.building;
          delete this.optimisticClaims[`${ch.x},${ch.y}`];
        }
        for (const p of event.players) {
          const player = this.state.players.find((pl) => pl.id === p.id);
          if (player) player.resources = p.resources;
        }
        this.attackWarnings = this.attackWarnings.filter(w => w.expiresAt > now);
      });

      // Resource-only patch — from the 1s production tick
      socket.on("game:resources_update", (event: ResourceUpdateEvent) => {
        if (!this.state) return;
        for (const p of event.players) {
          const player = this.state.players.find((pl) => pl.id === p.id);
          if (player) player.resources = p.resources;
        }
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

    async onTileClick(pos: Vec2) {
      if (!this.state) return;
      if (this.state.status === "PLACING") return this.chooseStart(this.state.gameId, pos);
      if (this.state.status !== "ACTIVE") return;

      if (this.maritimeLandingMode) return this.maritimeLand(this.state.gameId, pos);
      if (this.selectedBuilding != null) return this.build(this.state.gameId, pos, this.selectedBuilding);

      const meId = this.mePlayer?.id;
      if (meId) {
        const i = tileIndex(pos.x, pos.y, this.state.width);
        const owner = this.state.tiles.owners[i];
        if (owner && owner !== meId) {
          const hasBarracks = this.state.tiles.buildings.some(
            (b, j) => this.state!.tiles.owners[j] === meId && b === BuildingType.Barracks
          );
          if (!hasBarracks) return;
          return this.attackTile(this.state.gameId, pos);
        }
      }
      return this.claimTile(this.state.gameId, pos);
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

    autoAttack() {
      const state = this.state;
      const target = this.attackTarget;
      if (!state || !target || state.status !== "ACTIVE") return;

      const myId = this.mePlayer?.id;
      const mySoldiers = this.mePlayer?.resources.soldiers ?? 0;
      if (!myId || mySoldiers < 1) return;

      // Cible déjà conquise ?
      if (state.tiles.owners[target.y * state.width + target.x] === myId) {
        this.clearAttackTarget();
        return;
      }

      // Cases ennemies adjacentes à notre territoire
      const frontier: Vec2[] = [];
      for (let i = 0; i < state.tiles.owners.length; i++) {
        const owner = state.tiles.owners[i];
        if (!owner || owner === myId) continue;
        if ((state.tiles.types[i] as TileType) !== TileType.Plain) continue;
        const x = i % state.width;
        const y = Math.floor(i / state.width);
        const adjToMe = (
          [{ x: x+1, y }, { x: x-1, y }, { x, y: y+1 }, { x, y: y-1 }] as Vec2[]
        ).some(n => {
          if (n.x < 0 || n.y < 0 || n.x >= state.width || n.y >= state.height) return false;
          return state.tiles.owners[n.y * state.width + n.x] === myId;
        });
        if (adjToMe) frontier.push({ x, y });
      }

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

      // Trouver toutes les cases frontière (cases vides adjacentes à notre territoire)
      const frontierSet = new Set<string>();
      const frontier: Vec2[] = [];
      for (let i = 0; i < state.tiles.owners.length; i++) {
        if (state.tiles.owners[i] !== myId) continue;
        const x = i % state.width;
        const y = Math.floor(i / state.width);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
          const key = `${nx},${ny}`;
          if (frontierSet.has(key)) continue;
          const ni = ny * state.width + nx;
          if (state.tiles.owners[ni] === null && (state.tiles.types[ni] as TileType) === TileType.Plain) {
            frontier.push({ x: nx, y: ny });
            frontierSet.add(key);
          }
        }
      }

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
