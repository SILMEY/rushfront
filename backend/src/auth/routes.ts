import type { FastifyInstance } from "fastify";
import { createGoogleClient, upsertUserFromGoogle } from "./google.js";
import { discordAuthUrl, exchangeDiscordCode, upsertUserFromDiscord } from "./discord.js";
import { z } from "zod";

function cookieOptionsForRequest(params: { webOrigin: string; reqHost?: string; isHttps?: boolean }) {
  const { webOrigin, reqHost, isHttps } = params;
  const isProd = process.env.NODE_ENV === "production";

  let sameSite: "lax" | "none" = isProd ? "none" : "lax";
  try {
    const webHost = new URL(webOrigin).hostname;
    if (reqHost && webHost && webHost === reqHost) sameSite = "lax";
  } catch {
    // keep default
  }

  const secure = sameSite === "none" ? true : Boolean(isHttps);
  const domain = process.env.COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true as const,
    sameSite,
    secure,
    path: "/" as const,
    ...(domain ? { domain } : {})
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/google/start", async (_req, reply) => {
    let client;
    try {
      client = createGoogleClient();
    } catch {
      return reply.code(503).send({ error: "google_oauth_not_configured" });
    }
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "select_account"
    });
    reply.redirect(url);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const code = (req.query as any)?.code as string | undefined;
    if (!code) return reply.code(400).send({ error: "missing_code" });

    let client;
    try {
      client = createGoogleClient();
    } catch {
      return reply.code(503).send({ error: "google_oauth_not_configured" });
    }
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return reply.code(400).send({ error: "missing_id_token" });

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.name) return reply.code(400).send({ error: "invalid_profile" });

    const user = await upsertUserFromGoogle({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture
    });

    const jwt = await reply.jwtSign({ userId: user.id });
    const webOrigin = process.env.WEB_ORIGIN!;
    const cookieOpts = cookieOptionsForRequest({
      webOrigin,
      reqHost: req.hostname,
      isHttps: (req.headers["x-forwarded-proto"] ?? "").toString().includes("https")
    });

    // Fallback for cross-site deployments (Railway front/back on different hosts):
    // browsers may block third-party cookies, so we also pass a token via the redirect URL.
    const redirectUrl =
      cookieOpts.sameSite === "none" ? `${webOrigin}/?tr_token=${encodeURIComponent(jwt)}` : webOrigin;

    reply.setCookie("tr_session", jwt, cookieOpts).redirect(redirectUrl);
  });

  function serializeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      pseudo: user.pseudo,
      avatarUrl: user.avatarUrl,
      preferredColor: user.preferredColor ?? null,
      preferredCivilization: user.preferredCivilization ?? null
    };
  }

  // ── Discord OAuth ────────────────────────────────────────────────────────

  app.get("/auth/discord/start", async (_req, reply) => {
    try {
      return reply.redirect(discordAuthUrl());
    } catch {
      return reply.code(503).send({ error: "discord_oauth_not_configured" });
    }
  });

  app.get("/auth/discord/callback", async (req, reply) => {
    const code = (req.query as any)?.code as string | undefined;
    if (!code) return reply.code(400).send({ error: "missing_code" });

    const profile = await exchangeDiscordCode(code);
    const user = await upsertUserFromDiscord(profile);

    const jwt = await reply.jwtSign({ userId: user.id });
    const webOrigin = process.env.WEB_ORIGIN!;
    const cookieOpts = cookieOptionsForRequest({
      webOrigin,
      reqHost: req.hostname,
      isHttps: (req.headers["x-forwarded-proto"] ?? "").toString().includes("https")
    });

    const redirectUrl =
      cookieOpts.sameSite === "none"
        ? `${webOrigin}/?tr_token=${encodeURIComponent(jwt)}`
        : webOrigin;

    reply.setCookie("tr_session", jwt, cookieOpts).redirect(redirectUrl);
  });

  // ── /auth/me ─────────────────────────────────────────────────────────────

  app.get("/auth/me", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(200).send({ user: null });
    }
    const user = await app.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return reply.code(200).send({ user: null });
    return reply.send({ user: serializeUser(user) });
  });

  const PseudoSchema = z
    .string()
    .trim()
    .min(3, "pseudo_too_short")
    .max(20, "pseudo_too_long")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*[a-zA-Z0-9]$/, "pseudo_invalid");

  app.put("/profile/pseudo", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const body = (req.body ?? {}) as any;
    const parsed = PseudoSchema.safeParse(body.pseudo);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "invalid_pseudo";
      return reply.code(400).send({ error: msg });
    }

    const pseudo = parsed.data;
    try {
      const user = await app.prisma.user.update({
        where: { id: req.user.userId },
        data: { pseudo }
      });
      return reply.send({ user: serializeUser(user) });
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "pseudo_taken" });
      throw e;
    }
  });

  const VALID_CIVS = ["iron_dwarves", "sylvan_elves", "steppe_horde", "aurelian_empire"];
  const VALID_COLORS = ["#3b82f6","#ef4444","#a855f7","#fde047","#f97316","#ffffff","#22c55e","#f472b6","#06b6d4","#e11d48"];

  app.put("/profile/preferences", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const body = (req.body ?? {}) as any;
    const color = body.preferredColor ?? null;
    const civ   = body.preferredCivilization ?? null;
    if (color !== null && !VALID_COLORS.includes(color)) return reply.code(400).send({ error: "invalid_color" });
    if (civ   !== null && !VALID_CIVS.includes(civ))     return reply.code(400).send({ error: "invalid_civilization" });
    const user = await app.prisma.user.update({
      where: { id: req.user.userId },
      data: { preferredColor: color, preferredCivilization: civ }
    });
    return reply.send({ user: serializeUser(user) });
  });

  app.post("/auth/logout", async (req, reply) => {
    const webOrigin = process.env.WEB_ORIGIN!;
    reply
      .clearCookie(
        "tr_session",
        cookieOptionsForRequest({
          webOrigin,
          reqHost: req.hostname,
          isHttps: (req.headers["x-forwarded-proto"] ?? "").toString().includes("https")
        })
      )
      .send({ ok: true });
  });
}
