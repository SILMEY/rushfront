import type { FastifyInstance } from "fastify";

// Limite simple en mémoire : 3 emails par IP par heure
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

export async function supportRoute(app: FastifyInstance) {
  app.post<{
    Body: { name: string; email: string; subject: string; message: string }
  }>("/api/support", async (req, reply) => {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.ip
      ?? "unknown";

    if (!checkRateLimit(ip)) {
      return reply.code(429).send({ error: "too_many_requests" });
    }

    const { name, email, subject, message } = req.body ?? {};

    if (
      typeof email   !== "string" || !email.includes("@") ||
      typeof subject !== "string" || !subject.trim() ||
      typeof message !== "string" || !message.trim()
    ) {
      return reply.code(400).send({ error: "invalid_fields" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      app.log.warn("RESEND_API_KEY not set — support email not sent");
      // On renvoie OK côté client pour ne pas bloquer en dev
      return reply.send({ ok: true });
    }

    const body = [
      `De : ${(name ?? "").trim() || "(non renseigné)"}`,
      `Email : ${email.trim()}`,
      "",
      message.trim()
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "FrontRush Support <support@frontrush.net>",
        to: ["support@frontrush.net"],
        reply_to: email.trim(),
        subject: `[Support] ${subject.trim()}`,
        text: body
      })
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      app.log.error({ status: res.status, err }, "Resend API error");
      return reply.code(502).send({ error: "email_send_failed" });
    }

    return reply.send({ ok: true });
  });
}
