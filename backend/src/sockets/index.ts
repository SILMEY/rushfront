import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { registerLobbyHandlers } from "./lobby.js";
import { registerGameHandlers } from "./game.js";

export async function registerSockets(app: FastifyInstance, gameManager: GameManager) {
  const io = new Server(app.server, {
    cors: {
      origin: process.env.WEB_ORIGIN,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthorized"));
      const payload = await app.jwt.verify<{ userId: string }>(token);
      (socket as any).userId = payload.userId;
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    registerLobbyHandlers(app, io, socket, gameManager);
    registerGameHandlers(app, io, socket, gameManager);
  });

  const lastTurns = new Map<string, number>();
  const interval = setInterval(() => {
    for (const instance of gameManager.listActive()) {
      const room = `game:${instance.id}`;
      io.to(room).emit("game:turn_tick", {
        gameId: instance.id,
        currentTurn: instance.currentTurn,
        turnEndsAt: instance.turnEndsAt,
        status: instance.status
      });
      const prev = lastTurns.get(instance.id);
      if (prev == null) {
        lastTurns.set(instance.id, instance.currentTurn);
        continue;
      }
      if (instance.currentTurn !== prev) {
        lastTurns.set(instance.id, instance.currentTurn);
        io.to(room).emit("game:turn_resolved", { gameId: instance.id, currentTurn: instance.currentTurn });
        io.to(room).emit("game:state", instance.snapshot());
      }
    }
  }, 1000);

  app.addHook("onClose", async () => {
    clearInterval(interval);
  });

  return io;
}
