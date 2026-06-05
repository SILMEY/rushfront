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

    const [totalUsers, totalHumanGames, topPlayers, playersPerDay] = await Promise.all([
      app.prisma.user.count({
        where: { OR: [{ googleId: { not: null } }, { discordId: { not: null } }] }
      }),

      app.prisma.game.count({
        where: {
          status: "FINISHED",
          players: {
            some: {
              user: { OR: [{ googleId: { not: null } }, { discordId: { not: null } }] }
            }
          }
        }
      }),

      app.prisma.$queryRaw<{ id: string; pseudo: string | null; name: string; avatarUrl: string | null; gamesPlayed: number }[]>`
        SELECT u.id, u.pseudo, u.name, u."avatarUrl", COUNT(gp.id)::int AS "gamesPlayed"
        FROM "User" u
        JOIN "GamePlayer" gp ON gp."userId" = u.id
        WHERE (u."googleId" IS NOT NULL OR u."discordId" IS NOT NULL)
        GROUP BY u.id
        ORDER BY "gamesPlayed" DESC
        LIMIT 10
      `,

      app.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::int AS count
        FROM "User"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          AND ("googleId" IS NOT NULL OR "discordId" IS NOT NULL)
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `
    ]);

    return reply.send({ totalUsers, totalHumanGames, topPlayers, playersPerDay });
  });
}
