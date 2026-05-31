import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { BuildingType } from "../game/types.js";

function userIdOf(socket: Socket) {
  const uid = (socket as any).userId as string | undefined;
  if (!uid) throw new Error("unauthorized");
  return uid;
}

export function registerGameHandlers(_app: FastifyInstance, io: Server, socket: Socket, gameManager: GameManager) {
  socket.on("game:leave", async (payload: { gameId: string }) => {
    try {
      await socket.leave(`game:${payload.gameId}`);
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:get_state", async (payload: { gameId: string }) => {
    try {
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      await socket.join(`game:${payload.gameId}`);
      socket.emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:choose_start", async (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      instance.chooseStart(userId, { x: payload.x, y: payload.y });
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:claim_tile", async (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      instance.claimTile(userId, { x: payload.x, y: payload.y });
      // Don't broadcast full state on every claim; clients render optimistically.
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:claim_tiles", async (payload: { gameId: string; tiles: Array<{ x: number; y: number }> }) => {
    try {
      const userId = userIdOf(socket);
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      for (const t of payload.tiles) instance.claimTile(userId, { x: t.x, y: t.y });
      // No full state broadcast here either.
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:cancel_claim", async (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      instance.cancelClaim(userId, { x: payload.x, y: payload.y });
      // No full snapshot needed.
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:build", async (payload: { gameId: string; x: number; y: number; building: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      if (typeof payload.building !== "number" || !(payload.building in BuildingType)) throw new Error("invalid_building");
      instance.build(userId, { x: payload.x, y: payload.y, building: payload.building as BuildingType });
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:brouillage", async (payload: { gameId: string; tiles: Array<{ x: number; y: number }> }) => {
    try {
      const userId = userIdOf(socket);
      const instance = gameManager.getActive(payload.gameId);
      if (!instance) throw new Error("game_not_active");
      instance.setBrouillage(userId, payload.tiles);
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });
}
