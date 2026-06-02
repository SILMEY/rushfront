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
    gameOver: null as GameOverEvent | null
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

    async attackTile(gameId: string, pos: Vec2, amount: number) {
      if (!this.state) return;
      const meId = this.mePlayer?.id;
      if (!meId) return;
      if (!inBounds(pos, this.state)) return;
      const i = tileIndex(pos.x, pos.y, this.state.width);
      if ((this.state.tiles.types[i] as TileType) === TileType.Water) return;
      const owner = this.state.tiles.owners[i];
      if (!owner || owner === meId) return;
      if (!canClaimOptimistic(this.state, meId, pos)) return;
      const a = Math.floor(amount);
      if (!Number.isFinite(a) || a <= 0) return;
      if ((this.mePlayer?.resources.soldiers ?? 0) < a) return;

      this.optimisticClaims[`${pos.x},${pos.y}`] = true;
      const socket = await getSocket();
      socket.emit("game:attack_tile", { gameId, x: pos.x, y: pos.y, amount: a });
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
          const max = this.mePlayer?.resources.soldiers ?? 0;
          if (max <= 0) return;
          const raw = window.prompt(`Combien de soldats envoyer ? (1-${max})`, String(Math.min(10, max)));
          if (raw == null) return;
          const amount = Math.max(1, Math.min(max, Number.parseInt(raw, 10) || 0));
          return this.attackTile(this.state.gameId, pos, amount);
        }
      }
      return this.claimTile(this.state.gameId, pos);
    }
  }
});
