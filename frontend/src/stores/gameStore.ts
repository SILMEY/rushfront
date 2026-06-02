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
    _expandIntervalId: null as number | null
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
        for (const ch of event.changes) {
          const i = tileIndex(ch.x, ch.y, this.state.width);
          this.state.tiles.owners[i]    = ch.owner;
          this.state.tiles.buildings[i] = ch.building;
          delete this.optimisticClaims[`${ch.x},${ch.y}`];
        }
        for (const p of event.players) {
          const player = this.state.players.find((pl) => pl.id === p.id);
          if (player) player.resources = p.resources;
        }
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

    async onTileClick(pos: Vec2) {
      if (!this.state) return;
      if (this.state.status === "PLACING") return this.chooseStart(this.state.gameId, pos);
      if (this.state.status !== "ACTIVE") return;
      if (this.selectedBuilding != null) return this.build(this.state.gameId, pos, this.selectedBuilding);

      const meId = this.mePlayer?.id;
      if (meId) {
        const i = tileIndex(pos.x, pos.y, this.state.width);
        const owner = this.state.tiles.owners[i];
        if (owner && owner !== meId) {
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

      // Trier par distance à la cible (les plus proches d'abord)
      frontier.sort((a, b) => {
        const da = (a.x - target.x) ** 2 + (a.y - target.y) ** 2;
        const db = (b.x - target.x) ** 2 + (b.y - target.y) ** 2;
        return da - db;
      });

      // Réclamer jusqu'à 5 cases par tick (limité par les villageois dispo)
      const batch = frontier.slice(0, Math.min(5, myVillagers));
      void this.claimTiles(state.gameId, batch);
    }
  }
});
