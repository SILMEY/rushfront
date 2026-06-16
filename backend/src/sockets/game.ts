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
  socket.on("game:chat", (payload: { gameId: string; text: string; authorName: string; authorColor: string }) => {
    const text = String(payload.text ?? "").slice(0, 300).trim();
    if (!text) return;
    io.to(`game:${payload.gameId}`).emit("game:chat", {
      authorName: String(payload.authorName ?? "?").slice(0, 32),
      authorColor: String(payload.authorColor ?? "#ffffff"),
      text,
      timestamp: Date.now()
    });
  });

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

      // Only wire callbacks once per game instance (prevents duplicate broadcasts on reconnect)
      if (!instance.onResourceTick) {
        instance.onResourceTick = (players) => {
          const active = players.filter(p => !(p as any).eliminated);
          io.to(room).emit("game:resources_update", { players: active });
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
        instance.onBotAction = (changes, players, wonders) => {
          io.to(room).emit("game:tile_update", { changes, players, wonders });
        };
        instance.onGameStart = () => {
          io.to(room).emit("game:state", instance.snapshot());
        };
        instance.onGalleonUpdate = (galleons, fires) => {
          io.to(room).emit("game:galleons_update", { galleons, fires });
        };
        instance.onLandUnitsUpdate = (units, tileChanges) => {
          io.to(room).emit("game:land_units_update", { units });
          if (tileChanges.length > 0) {
            io.to(room).emit("game:tile_update", { changes: tileChanges, players: [] });
          }
        };
        instance.onCatapultFire = (center, changes) => {
          io.to(room).emit("game:catapult_fire", { center, changes });
        };
        instance.onCurseApplied = (changes, playerId) => {
          io.to(room).emit("game:curse_applied", { changes, playerId });
        };
      }
      // Wonder victory already fires through onGameOver

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

  socket.on("game:attack_tile", async (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const { change, defenderId, wonders } = instance.attackTile(userId, { x: payload.x, y: payload.y });
      const attacker = instance.getPlayerByUserId(userId)!;
      const defender = instance.players.find((p) => p.id === defenderId);
      const playerPatches: object[] = [{ id: attacker.id, resources: attacker.resources }];
      if (defender) {
        playerPatches.push({
          id: defender.id,
          resources: defender.resources,
          fishingBoats:    (defender as any).fishingBoats    ?? 0,
          maritimeCharges: (defender as any).maritimeCharges ?? 0,
        });
      }
      io.to(`game:${payload.gameId}`).emit("game:tile_update", { changes: [change], players: playerPatches, wonders });
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
      const update: Record<string, unknown> = {
        changes: [change],
        players: [{ id: player.id, resources: player.resources }]
      };
      if (payload.building === BuildingType.Wonder) {
        update.wonders = instance.wonders.map(w => ({ playerId: w.playerId, endsAt: w.endsAt }));
      }
      io.to(`game:${payload.gameId}`).emit("game:tile_update", update);
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

      if (!instance.hasBuilding(player.id, BuildingType.Barracks)) throw new Error("need_barracks");

      const total = player.resources.villagers + player.resources.soldiers;
      if (typeof payload.soldierPct === "number" && Number.isFinite(payload.soldierPct)) {
        const pct = Math.max(0, Math.min(100, Math.round(payload.soldierPct)));
        (player as any).desiredSoldierPct = pct;
      } else {
        const soldiers = Math.max(0, Math.min(total, Math.floor(payload.soldiers ?? 0)));
        (player as any).desiredSoldierPct = total > 0 ? Math.round((soldiers / total) * 100) : 0;
      }
      // Réinitialise la courbe d'accélération à chaque changement de cible
      (player as any).conversionIndex  = 0;
      (player as any).conversionCredit = 0;
      // Pas de changement immédiat — la conversion est progressive via applyProduction
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
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:player_update", {
        player: { id: player.id, resources: player.resources, techs: (player as any).techs }
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Unités terrestres ────────────────────────────────────────────────────

  socket.on("game:buy_land_unit", (payload: { gameId: string; barracksX: number; barracksY: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.buyLandUnit(userId, { x: payload.barracksX, y: payload.barracksY });
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:land_units_update", { units: instance.landUnits });
      socket.emit("game:player_update", { player: { id: player.id, resources: player.resources } });
    } catch (e: any) { socket.emit("game:error", { error: e?.message ?? "unknown_error" }); }
  });

  socket.on("game:fire_catapult", (payload: { gameId: string; targetX: number; targetY: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const result = instance.fireCatapultAt(userId, { x: payload.targetX, y: payload.targetY });
      if (result.changes.length > 0) {
        io.to(`game:${payload.gameId}`).emit("game:catapult_fire", {
          center: result.center,
          changes: result.changes,
          cooldownEnds: result.cooldownEnds
        });
        io.to(`game:${payload.gameId}`).emit("game:tile_update", { changes: result.changes, players: [] });
      }
    } catch (e: any) { socket.emit("game:error", { error: e?.message ?? "unknown_error" }); }
  });

  socket.on("game:curse_forest", (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const { changes, forestTiles } = instance.cursedForest(userId, { x: payload.x, y: payload.y });
      const player = instance.getPlayerByUserId(userId)!;
      if (changes.length > 0) {
        io.to(`game:${payload.gameId}`).emit("game:tile_update", {
          changes,
          players: [{ id: player.id, resources: player.resources, cursedForestCooldownEnds: (player as any).cursedForestCooldownEnds }]
        });
      }
      io.to(`game:${payload.gameId}`).emit("game:curse_applied", {
        forestTiles,
        playerId: player.id,
        cooldownEnds: (player as any).cursedForestCooldownEnds
      });
    } catch (e: any) { socket.emit("game:error", { error: e?.message ?? "unknown_error" }); }
  });

  // ── Galions ───────────────────────────────────────────────────────────────

  socket.on("game:buy_galleon", (payload: { gameId: string; portX: number; portY: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.buyGalleon(userId, { x: payload.portX, y: payload.portY });
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:galleons_update", { galleons: instance.galleons, fires: [] });
      socket.emit("game:player_update", { player: { id: player.id, resources: player.resources } });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Port : bateaux ───────────────────────────────────────────────────────

  socket.on("game:buy_fishing_boat", (payload: { gameId: string; portX: number; portY: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.buyFishingBoat(userId, { x: payload.portX, y: payload.portY });
      const player = instance.getPlayerByUserId(userId)!;
      socket.emit("game:player_update", {
        player: { id: player.id, resources: player.resources, portFishingBoats: (player as any).portFishingBoats }
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:buy_transport_boat", (payload: { gameId: string; portX: number; portY: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.buyTransportBoat(userId, { x: payload.portX, y: payload.portY });
      const player = instance.getPlayerByUserId(userId)!;
      socket.emit("game:player_update", {
        player: { id: player.id, resources: player.resources, maritimeCharges: player.maritimeCharges, portTransports: (player as any).portTransports }
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  socket.on("game:maritime_land", (payload: { gameId: string; x: number; y: number }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      const change = instance.maritimeLand(userId, { x: payload.x, y: payload.y });
      const player = instance.getPlayerByUserId(userId)!;
      io.to(`game:${payload.gameId}`).emit("game:tile_update", {
        changes: [change],
        players: [{ id: player.id, resources: player.resources, maritimeCharges: player.maritimeCharges }]
      });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });

  // ── Brouillage ───────────────────────────────────────────────────────────

  socket.on("game:maritime_animation", (payload: { gameId: string; animId: string; path: Array<{ x: number; y: number }> }) => {
    // Relay to all OTHER players in the room (sender already started theirs locally)
    socket.to(`game:${payload.gameId}`).emit("game:maritime_animation", {
      animId: payload.animId,
      path:   payload.path
    });
  });

  socket.on("game:brouillage", async (payload: { gameId: string; tiles: Array<{ x: number; y: number }> }) => {
    try {
      const userId = userIdOf(socket);
      const instance = getInstance(gameManager, payload.gameId);
      instance.setBrouillage(userId, payload.tiles);
      const added = payload.tiles.map(t => {
        const entry = instance.brouillageTiles.get(t.y * instance.width + t.x)!;
        return { casterPlayerId: entry.casterPlayerId, x: t.x, y: t.y, expiresAt: entry.expiresAt };
      });
      io.to(`game:${payload.gameId}`).emit("game:brouillage_patch", { added });
    } catch (e: any) {
      socket.emit("game:error", { error: e?.message ?? "unknown_error" });
    }
  });
}
