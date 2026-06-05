import { prisma } from "../prisma/client.js";
import { GameManager } from "./GameManager.js";
import { MAX_PLAYERS } from "./rules.js";
import type { Server } from "socket.io";

const QUICK_TIMEOUT_MS = 60_000;

export class QuickMatchmaker {
  private queue: string[] = []; // userIds
  private timer: NodeJS.Timeout | null = null;
  private timerStartedAt: number | null = null;

  async join(userId: string, io: Server, gameManager: GameManager): Promise<void> {
    if (this.queue.includes(userId)) return;

    this.queue.push(userId);
    this.broadcastUpdate(io);

    if (this.queue.length >= MAX_PLAYERS) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      await this.launch(io, gameManager);
      return;
    }

    if (!this.timer) {
      this.timerStartedAt = Date.now();
      this.timer = setTimeout(() => void this.launch(io, gameManager), QUICK_TIMEOUT_MS);
    }
  }

  leave(userId: string, io: Server): void {
    const idx = this.queue.indexOf(userId);
    if (idx === -1) return;
    this.queue.splice(idx, 1);

    if (this.queue.length === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.timerStartedAt = null;
    }

    this.broadcastUpdate(io);
  }

  isInQueue(userId: string): boolean {
    return this.queue.includes(userId);
  }

  private secondsRemaining(): number {
    if (!this.timerStartedAt) return QUICK_TIMEOUT_MS / 1000;
    return Math.max(0, Math.ceil((QUICK_TIMEOUT_MS - (Date.now() - this.timerStartedAt)) / 1000));
  }

  private broadcastUpdate(io: Server): void {
    const payload = { queueSize: this.queue.length, secondsRemaining: this.secondsRemaining() };
    for (const uid of this.queue) {
      for (const s of io.sockets.sockets.values()) {
        if ((s as any).userId === uid && s.connected) s.emit("quick:update", payload);
      }
    }
  }

  private async launch(io: Server, gameManager: GameManager): Promise<void> {
    this.timer = null;
    this.timerStartedAt = null;
    if (this.queue.length === 0) return;

    const players = this.queue.splice(0);

    try {
      const hostUserId = players[0]!;
      const gameId = await gameManager.createLobby(hostUserId);

      for (const uid of players.slice(1)) {
        await gameManager.joinLobby(gameId, uid);
      }

      await prisma.gamePlayer.updateMany({ where: { gameId }, data: { isReady: true } });

      const botsNeeded = MAX_PLAYERS - players.length;
      for (let i = 0; i < botsNeeded; i++) {
        await gameManager.addBot(gameId, hostUserId);
      }

      const instance = await gameManager.startGame(gameId, hostUserId, "quick");

      for (const uid of players) {
        for (const s of io.sockets.sockets.values()) {
          if ((s as any).userId === uid && s.connected) {
            await s.join(`game:${gameId}`);
            s.emit("quick:matched", { gameId });
          }
        }
      }

      io.to(`game:${gameId}`).emit("game:started", { gameId });
      io.to(`game:${gameId}`).emit("game:state", instance.snapshot());
    } catch (e) {
      console.error("[QuickMatchmaker] launch error:", e);
      for (const uid of players) {
        for (const s of io.sockets.sockets.values()) {
          if ((s as any).userId === uid && s.connected) {
            s.emit("game:error", { error: "quick_game_failed" });
          }
        }
      }
    }
  }
}
