import { randomUUID } from "crypto";
import { prisma } from "../prisma/client.js";
import { BotAI } from "./BotAI.js";
import { GameInstance } from "./GameInstance.js";
import { MAX_PLAYERS, PLAYER_COLORS } from "./rules.js";
import { CIVILIZATIONS, DEFAULT_CIVILIZATION, type BotConfig, type CivilizationId } from "./types.js";

const BOT_CIV_NAMES: Record<CivilizationId, string> = {
  iron_dwarves:    "Bot Nains de Fer",
  sylvan_elves:    "Bot Elfes Sylvains",
  steppe_horde:    "Bot Horde des Steppes",
  aurelian_empire: "Bot Empire d'Aurélien"
};

const LOBBY_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class GameManager {
  private active = new Map<string, GameInstance>();
  private cleanupInterval: NodeJS.Timeout;
  private botConfigs = new Map<string, BotConfig[]>();

  constructor() {
    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => void this.cleanupStaleLobbies(), 2 * 60 * 1000);
    void this.cleanupStaleLobbies(); // also run once at startup
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }

  private async cleanupStaleLobbies() {
    const cutoff = new Date(Date.now() - LOBBY_TTL_MS);
    const stale = await prisma.game.findMany({
      where: { status: "LOBBY", updatedAt: { lt: cutoff } },
      select: { id: true }
    });
    if (stale.length === 0) return;
    await prisma.game.deleteMany({
      where: { id: { in: stale.map((g) => g.id) } }
    });
    console.log(`[cleanup] removed ${stale.length} stale lobby(ies)`);
  }

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
    return games.map((g) => {
      const bots = this.botConfigs.get(g.id) ?? [];
      const humanPlayers = g.players.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.pseudo ?? p.user.name,
        avatarUrl: p.user.avatarUrl as string | null | undefined,
        color: p.color,
        civilization: p.civilization as CivilizationId,
        isReady: p.isReady,
        isBot: false as const
      }));
      const botPlayers = bots.map((b) => ({
        id: b.id,
        userId: b.userId,
        name: b.name,
        avatarUrl: null as null,
        color: b.color,
        civilization: b.civilization,
        isReady: true as const,
        isBot: true as const
      }));
      return {
        id: g.id,
        status: g.status,
        hostUserId: g.hostUserId,
        playerCount: humanPlayers.length + botPlayers.length,
        players: [...humanPlayers, ...botPlayers]
      };
    });
  }

  async createLobby(hostUserId: string) {
    const host = await prisma.user.findUnique({ where: { id: hostUserId } });
    const color = host?.preferredColor ?? PLAYER_COLORS[0]!;
    const civilization = (host?.preferredCivilization as CivilizationId | null) ?? DEFAULT_CIVILIZATION;
    const game = await prisma.game.create({
      data: {
        hostUserId,
        status: "LOBBY",
        players: {
          create: { userId: hostUserId, color, civilization, isReady: false }
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const usedColors = new Set(game.players.map((p) => p.color));

    let color: string;
    if (user?.preferredColor && !usedColors.has(user.preferredColor)) {
      color = user.preferredColor;
    } else {
      color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[game.players.length % PLAYER_COLORS.length]!;
    }

    const civilization = (user?.preferredCivilization as CivilizationId | null) ?? DEFAULT_CIVILIZATION;

    const gp = await prisma.gamePlayer.create({
      data: { gameId, userId, color, civilization }
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
      this.botConfigs.delete(gameId);
      return;
    }
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (game?.hostUserId === userId) {
      await prisma.game.update({ where: { id: gameId }, data: { hostUserId: remaining[0]!.userId } });
    }
  }

  async addBot(gameId: string, hostUserId: string, civilization?: CivilizationId): Promise<BotConfig> {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) throw new Error("lobby_not_found");
    if (game.hostUserId !== hostUserId) throw new Error("not_host");
    if (game.status !== "LOBBY") throw new Error("lobby_not_open");

    const currentBots = this.botConfigs.get(gameId) ?? [];
    if (game.players.length + currentBots.length >= MAX_PLAYERS) throw new Error("lobby_full");

    const usedColors = new Set([
      ...game.players.map(p => p.color),
      ...currentBots.map(b => b.color)
    ]);
    const color = PLAYER_COLORS.find(c => !usedColors.has(c)) ?? PLAYER_COLORS[0]!;

    const civIds = Object.keys(CIVILIZATIONS) as CivilizationId[];
    const civ: CivilizationId = civilization ?? civIds[Math.floor(Math.random() * civIds.length)]!;

    const id = randomUUID();
    const bot: BotConfig = {
      id: `bot_player:${id}`,
      userId: `bot:${id}`,
      name: BOT_CIV_NAMES[civ],
      color,
      civilization: civ
    };

    currentBots.push(bot);
    this.botConfigs.set(gameId, currentBots);
    return bot;
  }

  async removeBot(gameId: string, hostUserId: string, botId: string): Promise<void> {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new Error("lobby_not_found");
    if (game.hostUserId !== hostUserId) throw new Error("not_host");
    if (game.status !== "LOBBY") throw new Error("lobby_not_open");

    const currentBots = this.botConfigs.get(gameId) ?? [];
    const idx = currentBots.findIndex(b => b.id === botId);
    if (idx === -1) throw new Error("bot_not_found");
    currentBots.splice(idx, 1);
    this.botConfigs.set(gameId, currentBots);
  }

  async setReady(gameId: string, userId: string, isReady: boolean) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { isReady }
    });
  }

  async setCivilization(gameId: string, userId: string, civilization: CivilizationId) {
    const VALID: CivilizationId[] = ["iron_dwarves", "sylvan_elves", "steppe_horde", "aurelian_empire"];
    if (!VALID.includes(civilization)) throw new Error("invalid_civilization");
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { civilization }
    });
  }

  async setColor(gameId: string, userId: string, color: string) {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) throw new Error("lobby_not_found");
    if (game.status !== "LOBBY") throw new Error("lobby_not_open");
    if (!PLAYER_COLORS.includes(color)) throw new Error("invalid_color");
    const used = game.players.find((p) => p.color === color && p.userId !== userId);
    if (used) throw new Error("color_taken");
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { color }
    });
  }

  async startGame(gameId: string, userId: string, gameType: "quick" | "custom" = "custom") {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) throw new Error("lobby_not_found");
    if (game.hostUserId !== userId) throw new Error("not_host");
    if (game.status !== "LOBBY") throw new Error("not_in_lobby");

    const bots = this.botConfigs.get(gameId) ?? [];
    const readyCount = game.players.filter((p) => p.isReady).length;
    if (readyCount < 1) throw new Error("need_two_ready");
    if (readyCount + bots.length < 2) throw new Error("need_two_ready");

    await prisma.game.update({ where: { id: gameId }, data: { status: "PLACING" } });
    const instance = new GameInstance(gameId);
    instance.gameType = gameType;
    await instance.loadFromDb();

    // Injecter les bots et démarrer leur IA
    this.botConfigs.delete(gameId);
    for (const botConfig of bots) {
      instance.injectBotPlayer(botConfig);
      const ai = new BotAI(instance, botConfig.userId);
      instance.registerBot(ai);
      ai.start();
      // Placement dans 1-3 secondes pour laisser le temps à la phase PLACING
      const delay = 1000 + Math.random() * 2000;
      setTimeout(() => ai.place(), delay);
    }

    this.active.set(gameId, instance);
    return instance;
  }
}
