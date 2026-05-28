import { defineStore } from "pinia";
import type { GameStateSnapshot, Vec2 } from "../types/game";
import { BuildingType } from "../types/game";
import { getSocket } from "../composables/useSocket";
import { useAuthStore } from "./authStore";

export const useGameStore = defineStore("game", {
  state: () => ({
    state: null as GameStateSnapshot | null,
    connected: false,
    lastError: "" as string | null,
    hoveredTile: null as Vec2 | null,
    selectedBuilding: null as BuildingType | null
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
      socket.on("game:state", (snapshot: GameStateSnapshot) => {
        this.state = snapshot;
      });
      socket.on("game:error", ({ error }: { error: string }) => {
        this.lastError = error;
      });
      this.connected = true;
    },
    async getState(gameId: string) {
      const socket = await getSocket();
      socket.emit("game:get_state", { gameId });
    },
    async chooseStart(gameId: string, pos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:choose_start", { gameId, x: pos.x, y: pos.y });
    },
    async claimTile(gameId: string, pos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:claim_tile", { gameId, x: pos.x, y: pos.y });
    },
    async cancelClaim(gameId: string, pos: Vec2) {
      const socket = await getSocket();
      socket.emit("game:cancel_claim", { gameId, x: pos.x, y: pos.y });
    },
    async build(gameId: string, pos: Vec2, building: BuildingType) {
      const socket = await getSocket();
      socket.emit("game:build", { gameId, x: pos.x, y: pos.y, building });
    },
    setHovered(pos: Vec2 | null) {
      this.hoveredTile = pos;
    },
    async onTileClick(pos: Vec2) {
      if (!this.state) return;
      if (this.state.status === "PLACING") return this.chooseStart(this.state.gameId, pos);
      if (this.state.status !== "ACTIVE") return;
      if (this.selectedBuilding != null) return this.build(this.state.gameId, pos, this.selectedBuilding);
      return this.claimTile(this.state.gameId, pos);
    }
  }
});

