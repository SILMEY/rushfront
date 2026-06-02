import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { BuildingType } from "../game/types.js";
import { TECHS } from "../game/tech.js";

function userIdOf(socket: Socket) {
  const uid = (socket as any).userId as string | undefined;
  if (!uid) throw new Error("unauthorized");
  return uid;
}

function getInstance(gameManager: GameManager, gameId: string) {
  const instance = gameManager.getActive(gameId);
  if (!instance) throw new Error("game_not_active");
  return instance;
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
      const instance = getInstance(gameManager, payload.gameId);
      await socket.join(`game:${payload.gameId}`);
      const room = `game:${payload.gameId}`;

      instance.onResourceTick = (players) => {
        io.to(room).emit("game:resources_update", { players });
      };
      instance.onPlayerEliminated = (playerId, changes) => {
        io.to(room).emit("game:player_eliminated", { playerId, changes });
      };
      instance.onGameOver = (winner) => {
        io.to(room).emit("game:over", { winnerId: winner?.id ?? null, winnerName: winner?.name ?? null });
      };
      instance.onPlacingTimeout = () => {
        io.to(room).emit("game:state", instance.snapshot());
      };

      socket.emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:surrender", async (payload: { gameId: string }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const changes = instance.surrenderPlayer(userId);
      if (changes !== null) {
        const player = instance.players.find((p) => p.userId === userId);
        io.to(`game:${payload.gameId}`).emit("game:player_eliminated", {
          playerId: player?.id,
          changes
        });
      }
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:choose_start", async (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.chooseStart(userId, { x: payload.x, y: payload.y });
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Claim ────────────────────────────────────────────────────────────────

  socket.on("game:claim_tile", async (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const change = instance.claimTile(userId, { x: payload.x, y: payload.y });
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:tile_update", {
        changes: [change],
        players: [{ id: player.id, resources: player.resources }]
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:claim_tiles", async (payload: { gameId: string; tiles: Array<{ x: number; y: number }> }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const changes = instance.claimTiles(userId, payload.tiles);
      if (changes.length === 0) return;
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:tile_update", {
        changes,
        players: [{ id: player.id, resources: player.resources }]
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Attack ───────────────────────────────────────────────────────────────

  socket.on("game:attack_tile", async (payload: { gameId: string; x: number; y: number; amount: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const change = instance.attackTile(userId, { x: payload.x, y: payload.y }, payload.amount);
      const attacker = instance.getPlayerByUserId(userId)!;
      const defender = instance.players.find((p) => p.id !== attacker.id && p.id === change.owner)
                    ?? instance.players.find((p) => p.id !== attacker.id); // fallback
      const playerPatches = [{ id: attacker.id, resources: attacker.resources }];
      // Include defender resource update so their soldier count is accurate for everyone
      if (defender) playerPatches.push({ id: defender.id, resources: defender.resources });
      io.to(`game:${payload.gameId}`).emit("game:tile_update", { changes: [change], players: playerPatches });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Build ────────────────────────────────────────────────────────────────

  socket.on("game:build", async (payload: { gameId: string; x: number; y: number; building: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      if (typeof payload.building !== "number" || !(payload.building in BuildingType))
        throw new Error("invalid_building");
      const change = instance.build(userId, { x: payload.x, y: payload.y, building: payload.building as BuildingType });
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:tile_update", {
        changes: [change],
        players: [{ id: player.id, resources: player.resources }]
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Composition ──────────────────────────────────────────────────────────

  socket.on("game:set_composition", async (payload: { gameId: string; soldierPct?: number; soldiers?: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const player = instance.getPlayerByUserId(userId);
      if (!player) throw new Error("not_in_game");

      const hasBarracks = instance.tileOwners.some(
        (o, i) => o === player.id && instance.tileBuildings[i] === BuildingType.Barracks
      );
      if (!hasBarracks) throw new Error("need_barracks");

      const total = player.resources.villagers + player.resources.soldiers;
      if (typeof payload.soldierPct === "number" && Number.isFinite(payload.soldierPct)) {
        const pct = Math.max(0, Math.min(100, Math.round(payload.soldierPct)));
        (player as any).desiredSoldierPct = pct;
        const soldiers = Math.max(0, Math.min(total, Math.round((pct / 100) * total)));
        player.resources.soldiers = soldiers;
        player.resources.villagers = total - soldiers;
      } else {
        const soldiers = Math.max(0, Math.min(total, Math.floor(payload.soldiers ?? 0)));
        player.resources.soldiers = soldiers;
        player.resources.villagers = total - soldiers;
        (player as any).desiredSoldierPct = total > 0 ? Math.round((soldiers / total) * 100) : 0;
      }
      // Only the requesting player needs to see their updated resources
      socket.emit("game:resources_update", { players: [{ id: player.id, resources: player.resources }] });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Tech ─────────────────────────────────────────────────────────────────

  socket.on("game:list_techs", async (payload: { gameId: string }) => {
    try {
      getInstance(gameManager, payload.gameId);
      socket.emit("game:techs", { techs: TECHS });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:buy_tech", async (payload: { gameId: string; techId: string }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.buyTech(userId, payload.techId);
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Brouillage ───────────────────────────────────────────────────────────

  socket.on("game:brouillage", async (payload: { gameId: string; tiles: Array<{ x: number; y: number }> }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.setBrouillage(userId, payload.tiles);
      io.to(`game:${payload.gameId}`).emit("game:state", instance.snapshot());
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });
}
