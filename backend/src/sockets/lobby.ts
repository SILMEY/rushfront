import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { QuickMatchmaker } from "../game/QuickMatchmaker.js";
import type { CivilizationId } from "../game/types.js";

const VALID_CIVS: CivilizationId[] = ["iron_dwarves", "sylvan_elves", "steppe_horde", "aurelian_empire"];

function userIdOf(socket: Socket) {
  const uid = (socket as any).userId as string | undefined;
  if (!uid) throw new Error("unauthorized");
  return uid;
}

export function registerLobbyHandlers(_app: FastifyInstance, io: Server, socket: Socket, gameManager: GameManager, quickMatchmaker: QuickMatchmaker) {
  socket.on("lobby:list", async () => {
    try {
      await socket.join("lobby");
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
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:join", async (payload: { gameId: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.joinLobby(payload.gameId, userId);
      await socket.join(`game:${payload.gameId}`);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:leave", async (payload: { gameId: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.leaveLobby(payload.gameId, userId);
      await socket.leave(`game:${payload.gameId}`);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:ready", async (payload: { gameId: string; isReady: boolean }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.setReady(payload.gameId, userId, payload.isReady);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:set_color", async (payload: { gameId: string; color: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.setColor(payload.gameId, userId, payload.color);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:set_civilization", async (payload: { gameId: string; civilization: CivilizationId }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.setCivilization(payload.gameId, userId, payload.civilization);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:chat", (payload: { gameId: string; text: string; authorName: string; authorColor: string }) => {
    const text = String(payload.text ?? "").slice(0, 300).trim();
    if (!text) return;
    io.to(`game:${payload.gameId}`).emit("lobby:chat", {
      authorName: String(payload.authorName ?? "?").slice(0, 32),
      authorColor: String(payload.authorColor ?? "#ffffff"),
      text,
      timestamp: Date.now()
    });
  });

  socket.on("lobby:add_bot", async (payload: { gameId: string; civilization?: string }) => {
    try {
      const userId = userIdOf(socket);
      const civ = VALID_CIVS.includes(payload.civilization as CivilizationId)
        ? (payload.civilization as CivilizationId)
        : undefined;
      await gameManager.addBot(payload.gameId, userId, civ);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("lobby:remove_bot", async (payload: { gameId: string; botId: string }) => {
    try {
      const userId = userIdOf(socket);
      await gameManager.removeBot(payload.gameId, userId, payload.botId);
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
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
      io.to("lobby").emit("lobby:updated", await gameManager.listLobbies());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("quick:join", async () => {
    try {
      const userId = userIdOf(socket);
      await quickMatchmaker.join(userId, io, gameManager);
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("quick:leave", () => {
    try {
      const userId = userIdOf(socket);
      quickMatchmaker.leave(userId, io);
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });
}
