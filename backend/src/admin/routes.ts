import type { FastifyInstance } from "fastify";

const ADMIN_EMAIL = "silvin10@gmail.com";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/stats", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const caller = await app.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true }
    });
    if (!caller || caller.email !== ADMIN_EMAIL) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const [
      totalUsers,
      totalHumanGames,
      gamesLast30Days,
      activeGamesNow,
      newUsersThisWeek,
      topPlayers,
      topWinners,
      civPopularity,
      playersPerDay,
      gamesPerDay,
    ] = await Promise.all([

      // Joueurs inscrits
      app.prisma.user.count({
        where: { OR: [{ googleId: { not: null } }, { discordId: { not: null } }] }
      }),

      // Parties jouées au total
      app.prisma.game.count({
        where: {
          status: "FINISHED",
          players: { some: { user: { OR: [{ googleId: { not: null } }, { discordId: { not: null } }] } } }
        }
      }),

      // Parties jouées — 30 derniers jours
      app.prisma.game.count({
        where: {
          status: "FINISHED",
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          players: { some: { user: { OR: [{ googleId: { not: null } }, { discordId: { not: null } }] } } }
        }
      }),

      // Parties actives en ce moment
      app.prisma.game.count({ where: { status: "ACTIVE" } }),

      // Nouveaux joueurs cette semaine
      app.prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          OR: [{ googleId: { not: null } }, { discordId: { not: null } }]
        }
      }),

      // Top 10 joueurs par parties jouées
      app.prisma.$queryRaw<{ id: string; pseudo: string | null; name: string; avatarUrl: string | null; gamesPlayed: number }[]>`
        SELECT u.id, u.pseudo, u.name, u."avatarUrl", COUNT(gp.id)::int AS "gamesPlayed"
        FROM "User" u
        JOIN "GamePlayer" gp ON gp."userId" = u.id
        WHERE (u."googleId" IS NOT NULL OR u."discordId" IS NOT NULL)
        GROUP BY u.id
        ORDER BY "gamesPlayed" DESC
        LIMIT 10
      `,

      // Top 5 vainqueurs (parties rapides gagnées)
      app.prisma.user.findMany({
        where: { quickGameWins: { gt: 0 }, OR: [{ googleId: { not: null } }, { discordId: { not: null } }] },
        orderBy: { quickGameWins: "desc" },
        take: 5,
        select: { id: true, pseudo: true, name: true, avatarUrl: true, quickGameWins: true }
      }),

      // Popularité des civilisations
      app.prisma.$queryRaw<{ civilization: string; count: number }[]>`
        SELECT gp.civilization, COUNT(*)::int AS count
        FROM "GamePlayer" gp
        JOIN "User" u ON u.id = gp."userId"
        WHERE (u."googleId" IS NOT NULL OR u."discordId" IS NOT NULL)
        GROUP BY gp.civilization
        ORDER BY count DESC
      `,

      // Nouveaux joueurs par jour — 30 derniers jours
      app.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::int AS count
        FROM "User"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          AND ("googleId" IS NOT NULL OR "discordId" IS NOT NULL)
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Parties jouées par jour — 30 derniers jours
      app.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("updatedAt")::text AS date, COUNT(*)::int AS count
        FROM "Game"
        WHERE status = 'FINISHED'
          AND "updatedAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("updatedAt")
        ORDER BY date ASC
      `,
    ]);

    return reply.send({
      totalUsers,
      totalHumanGames,
      gamesLast30Days,
      activeGamesNow,
      newUsersThisWeek,
      topPlayers,
      topWinners,
      civPopularity,
      playersPerDay,
      gamesPerDay,
    });
  });
}
