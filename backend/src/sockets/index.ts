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

  app.addHook("onClose", async () => {
    // nothing to clear — resource ticks are managed per-GameInstance
  });

  return io;
}
