import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { QuickMatchmaker } from "../game/QuickMatchmaker.js";
import { registerLobbyHandlers } from "./lobby.js";
import { registerGameHandlers } from "./game.js";

export async function registerSockets(app: FastifyInstance, gameManager: GameManager, quickMatchmaker: QuickMatchmaker) {
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

  // Timers de déconnexion en attente (userId → timeout)
  const pendingDisconnects = new Map<string, NodeJS.Timeout>();

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as string | undefined;

    // Si le joueur se reconnecte, annuler l'élimination en attente
    if (userId && pendingDisconnects.has(userId)) {
      clearTimeout(pendingDisconnects.get(userId)!);
      pendingDisconnects.delete(userId);
    }

    registerLobbyHandlers(app, io, socket, gameManager, quickMatchmaker);
    registerGameHandlers(app, io, socket, gameManager);

    socket.on("disconnect", () => {
      const uid = (socket as any).userId as string | undefined;
      if (!uid) return;

      // Grace period de 30s : le joueur a le temps de se reconnecter
      const timer = setTimeout(() => {
        pendingDisconnects.delete(uid);
        quickMatchmaker.leave(uid, io);

        // Vérifier qu'aucune autre socket du même utilisateur n'est connectée
        const stillConnected = [...io.sockets.sockets.values()].some(
          s => (s as any).userId === uid && s.connected
        );
        if (stillConnected) return;

        for (const instance of gameManager.listActive()) {
          if (instance.status !== "ACTIVE") continue;
          const changes = instance.surrenderPlayer(uid);
          if (changes !== null) break;
        }
      }, 30_000);

      pendingDisconnects.set(uid, timer);
    });
  });

  app.addHook("onClose", async () => {
    // nothing to clear — resource ticks are managed per-GameInstance
  });

  return io;
}
