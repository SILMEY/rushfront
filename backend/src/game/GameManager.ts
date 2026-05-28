import { prisma } from "../prisma/client.js";
import { GameInstance } from "./GameInstance.js";
import { MAX_PLAYERS, PLAYER_COLORS } from "./rules.js";

export class GameManager {
  private active = new Map<string, GameInstance>();

  getActive(gameId: string) {
    return this.active.get(gameId);
  }

  listActive() {
    return Array.from(this.active.values());
  }

  async listLobbies() {
    const games = await prisma.game.findMany({
      where: { status: "LOBBY" },
      orderBy: { createdAt: "desc" },
      include: { players: { include: { user: true } } }
    });
    return games.map((g) => ({
      id: g.id,
      status: g.status,
      hostUserId: g.hostUserId,
      playerCount: g.players.length,
      players: g.players.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
        color: p.color,
        isReady: p.isReady
      }))
    }));
  }

  async createLobby(hostUserId: string) {
    const game = await prisma.game.create({
      data: {
        hostUserId,
        status: "LOBBY",
        players: {
          create: {
            userId: hostUserId,
            color: PLAYER_COLORS[0]!,
            isReady: false
          }
        }
      }
    });
    return game.id;
  }

  async joinLobby(gameId: string, userId: string) {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) throw new Error("lobby_not_found");
    if (game.status !== "LOBBY") throw new Error("lobby_not_open");
    if (game.players.length >= MAX_PLAYERS) throw new Error("lobby_full");
    const existing = game.players.find((p) => p.userId === userId);
    if (existing) return existing.id;

    const usedColors = new Set(game.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[game.players.length % PLAYER_COLORS.length]!;

    const gp = await prisma.gamePlayer.create({
      data: { gameId, userId, color }
    });
    return gp.id;
  }

  async leaveLobby(gameId: string, userId: string) {
    const gp = await prisma.gamePlayer.findUnique({
      where: { gameId_userId: { gameId, userId } }
    });
    if (!gp) return;

    await prisma.gamePlayer.delete({ where: { id: gp.id } });
    const remaining = await prisma.gamePlayer.findMany({ where: { gameId } });
    if (remaining.length === 0) {
      await prisma.game.delete({ where: { id: gameId } });
      this.active.get(gameId)?.stop();
      this.active.delete(gameId);
      return;
    }
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (game?.hostUserId === userId) {
      await prisma.game.update({ where: { id: gameId }, data: { hostUserId: remaining[0]!.userId } });
    }
  }

  async setReady(gameId: string, userId: string, isReady: boolean) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { isReady }
    });
  }

  async startGame(gameId: string, userId: string) {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) throw new Error("lobby_not_found");
    if (game.hostUserId !== userId) throw new Error("not_host");
    if (game.status !== "LOBBY") throw new Error("not_in_lobby");
    const readyCount = game.players.filter((p) => p.isReady).length;
    if (readyCount < 2) throw new Error("need_two_ready");

    await prisma.game.update({ where: { id: gameId }, data: { status: "PLACING" } });
    const instance = new GameInstance(gameId);
    await instance.loadFromDb();
    this.active.set(gameId, instance);
    return instance;
  }
}
