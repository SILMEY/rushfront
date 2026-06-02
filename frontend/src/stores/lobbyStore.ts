import { defineStore } from "pinia";
import type { CivilizationId, LobbySummary } from "../types/lobby";
import { getSocket } from "../composables/useSocket";
import { router } from "../router";

export const useLobbyStore = defineStore("lobby", {
  state: () => ({
    lobbies: [] as LobbySummary[],
    lastError: "" as string | null,
    lastStartedGameId: null as string | null,
    connected: false
  }),
  actions: {
    async ensureConnected() {
      if (this.connected) return;
      const socket = await getSocket();
      socket.on("lobby:list", (lobbies: LobbySummary[]) => {
        this.lobbies = lobbies;
      });
      socket.on("lobby:updated", (lobbies: LobbySummary[]) => {
        this.lobbies = lobbies;
      });
      socket.on("lobby:created", ({ gameId }: { gameId: string }) => {
        this.lastError = null;
        router.push(`/lobby/${gameId}`);
      });
      socket.on("game:started", ({ gameId }: { gameId: string }) => {
        this.lastStartedGameId = gameId;
      });
      socket.on("game:error", ({ error }: { error: string }) => {
        this.lastError = error;
      });
      this.connected = true;
    },
    async refresh() {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:list");
    },
    async createLobby() {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:create");
    },
    async joinLobby(gameId: string) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:join", { gameId });
      socket.emit("lobby:list");
    },
    async leaveLobby(gameId: string) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:leave", { gameId });
      await this.refresh();
      router.push("/");
    },
    async setReady(gameId: string, isReady: boolean) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:ready", { gameId, isReady });
    },
    async startGame(gameId: string) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:start", { gameId });
    },
    async setColor(gameId: string, color: string) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:set_color", { gameId, color });
    },
    async setCivilization(gameId: string, civilization: CivilizationId) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:set_civilization", { gameId, civilization });
    }
  }
});
