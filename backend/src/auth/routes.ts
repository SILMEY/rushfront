import type { FastifyInstance } from "fastify";
import { createGoogleClient, upsertUserFromGoogle } from "./google.js";

function cookieOptionsForRequest(params: { webOrigin: string; reqHost?: string; isHttps?: boolean }) {
  const { webOrigin, reqHost, isHttps } = params;
  let sameSite: "lax" | "none" = "lax";
  try {
    const webHost = new URL(webOrigin).hostname;
    if (reqHost && webHost && webHost !== reqHost) sameSite = "none";
  } catch {
    // fallback to lax
  }
  // Modern browsers require Secure when SameSite=None.
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
    const cookieOpts = cookieOptionsForRequest({
      webOrigin: process.env.WEB_ORIGIN!,
      reqHost: req.hostname,
      isHttps: (req.headers["x-forwarded-proto"] ?? "").toString().includes("https")
    });
    reply
      .setCookie("tr_session", jwt, {
        ...cookieOpts
      })
      .redirect(process.env.WEB_ORIGIN!);
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
        avatarUrl: user.avatarUrl
      }
    });
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply
      .clearCookie("tr_session", {
        ...cookieOptionsForRequest({
          webOrigin: process.env.WEB_ORIGIN!,
          reqHost: undefined,
          isHttps: true
        })
      })
      .send({ ok: true });
  });
}
