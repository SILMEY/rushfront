import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import type { CivilizationId } from "../game/types.js";

function userIdOf(socket: Socket) {
  const uid = (socket as any).userId as string | undefined;
  if (!uid) throw new Error("unauthorized");
  return uid;
}

export function registerLobbyHandlers(_app: FastifyInstance, io: Server, socket: Socket, gameManager: GameManager) {
  socket.on("lobby:list", async () => {
    try {
      socket.emit("lobby:list", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:create", async () => {
    try {
      const userId = userIdOf(socket);
      const gameId = await gameManager.createLobby(userId);
      socket.emit("lobby:created", { gameId });
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:join", async (payload: { gameId: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.joinLobby(payload.gameId, userId);
      await socket.join(`game:${payload.gameId}`);
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:leave", async (payload: { gameId: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.leaveLobby(payload.gameId, userId);
      await socket.leave(`game:${payload.gameId}`);
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:ready", async (payload: { gameId: string; isReady: boolean }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.setReady(payload.gameId, userId, payload.isReady);
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:set_color", async (payload: { gameId: string; color: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.setColor(payload.gameId, userId, payload.color);
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:set_civilization", async (payload: { gameId: string; civilization: CivilizationId }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.setCivilization(payload.gameId, userId, payload.civilization);
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:start", async (payload: { gameId: string }) => {
    try {
      const userId = userIdOf(socket);
      const instance = await gameManager.startGame(payload.gameId, userId);
      io.to(`game:${payload.gameId}`).emit("game:started", { gameId: payload.gameId });
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
      io.emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });
}
