import { defineStore } from "pinia";
import type { CivilizationId, LobbySummary } from "../types/lobby";
import { getSocket } from "../composables/useSocket";
import { router } from "../router";

export const useLobbyStore = defineStore("lobby", {
  state: () => ({
    lobbies: [] as LobbySummary[],
    lastError: "" as string | null,
    lastStartedGameId: null as string | null,
    connected: false,
    inQuickQueue: false,
    quickQueueSize: 0,
    quickCountdownSeconds: 0
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
      socket.on("quick:update", ({ queueSize, secondsRemaining }: { queueSize: number; secondsRemaining: number }) => {
        this.inQuickQueue = true;
        this.quickQueueSize = queueSize;
        this.quickCountdownSeconds = secondsRemaining;
      });
      socket.on("quick:matched", ({ gameId }: { gameId: string }) => {
        this.inQuickQueue = false;
        this.quickQueueSize = 0;
        this.quickCountdownSeconds = 0;
        router.push(`/game/${gameId}`);
      });
      this.connected = true;
    },
    async refresh() {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:list");
    },
    async joinQuickGame() {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("quick:join");
    },
    async leaveQuickGame() {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("quick:leave");
      this.inQuickQueue = false;
      this.quickQueueSize = 0;
      this.quickCountdownSeconds = 0;
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
      this.refresh(); // don't await — fire and forget
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
    },
    async addBot(gameId: string, civilization?: CivilizationId) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:add_bot", { gameId, civilization });
    },
    async removeBot(gameId: string, botId: string) {
      await this.ensureConnected();
      const socket = await getSocket();
      socket.emit("lobby:remove_bot", { gameId, botId });
    }
  }
});
