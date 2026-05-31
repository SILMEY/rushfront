import type { FastifyInstance } from "fastify";
import { createGoogleClient, upsertUserFromGoogle } from "./google.js";
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

  app.get("/auth/me", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(200).send({ user: null });
    }
    const user = await app.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return reply.code(200).send({ user: null });
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pseudo: user.pseudo,
        avatarUrl: user.avatarUrl
      }
    });
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
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          pseudo: user.pseudo,
          avatarUrl: user.avatarUrl
        }
      });
    } catch (e: any) {
      // Prisma unique violation
      if (e?.code === "P2002") return reply.code(409).send({ error: "pseudo_taken" });
      throw e;
    }
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
