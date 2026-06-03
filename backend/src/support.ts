import type { FastifyInstance } from "fastify";
import https from "https";

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

function resendSend(apiKey: string, payload: object): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve({ ok: (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on("error", (err) => resolve({ ok: false, status: 0, body: String(err) }));
    req.write(bodyStr);
    req.end();
  });
}

export async function supportRoute(app: FastifyInstance) {
  app.post<{
    Body: { name?: string; email: string; subject: string; message: string }
  }>("/api/support", async (req, reply) => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";

    if (!checkRateLimit(ip)) {
      return reply.code(429).send({ error: "too_many_requests" });
    }

    const { name = "", email, subject, message } = req.body ?? ({} as any);

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
      return reply.send({ ok: true });
    }

    const emailBody = [
      `De : ${String(name).trim() || "(non renseigné)"}`,
      `Email : ${email.trim()}`,
      "",
      message.trim()
    ].join("\n");

    const result = await resendSend(apiKey, {
      from: "FrontRush Support <support@frontrush.net>",
      to: ["support@frontrush.net"],
      reply_to: email.trim(),
      subject: `[Support] ${subject.trim()}`,
      text: emailBody
    });

    if (!result.ok) {
      app.log.error({ status: result.status, body: result.body }, "Resend API error");
      return reply.code(502).send({ error: "email_send_failed" });
    }

    return reply.send({ ok: true });
  });
}
