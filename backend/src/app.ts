import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { prismaPlugin } from "./prisma/plugin.js";
import { jwtPlugin } from "./auth/jwt.js";
import { authRoutes } from "./auth/routes.js";

export function buildApp() {
  // Railway/Reverse proxies: trust X-Forwarded-* so cookies + redirects are correct.
  const app = Fastify({ logger: true, trustProxy: true });

  const allowedOrigins = new Set(
    [
      process.env.WEB_ORIGIN,
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ].filter(Boolean) as string[]
  );
  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error("not_allowed_by_cors"), false);
    },
    credentials: true
  });
  app.register(cookie);
  app.register(prismaPlugin);
  app.register(jwtPlugin);
  app.register(authRoutes);

  app.get("/healthz", async () => ({ ok: true }));

  // Socket.IO handshake uses a short-lived JWT obtained via HTTP (cookie-authenticated).
  app.get("/socket/token", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const token = await reply.jwtSign({ userId: req.user.userId }, { expiresIn: "15m" });
    return reply.send({ token });
  });

  return app;
}
