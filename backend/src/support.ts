import type { FastifyInstance } from "fastify";
import https from "https";

// Limite en mémoire : 10 envois par IP par heure
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LIMIT      = 10;
const WINDOW_MS  = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

function resendSend(
  apiKey: string,
  payload: object
): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(payload);
    let settled   = false;

    const req = https.request(
      {
        hostname : "api.resend.com",
        path     : "/emails",
        method   : "POST",
        timeout  : 8000, // 8s timeout réseau
        headers  : {
          Authorization   : `Bearer ${apiKey}`,
          "Content-Type"  : "application/json",
          "Content-Length": Buffer.byteLength(bodyStr)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ ok: (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, body: data });
        });
      }
    );

    req.on("timeout", () => {
      if (settled) return;
      settled = true;
      req.destroy();
      resolve({ ok: false, status: 0, body: "timeout connecting to Resend" });
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, status: 0, body: String(err) });
    });

    req.write(bodyStr);
    req.end();
  });
}

export async function supportRoute(app: FastifyInstance) {
  app.post<{
    Body: { name?: string; email: string; subject: string; message: string }
  }>("/api/support", async (req, reply) => {
    try {
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
        typeof subject !== "string" || !subject.trim()      ||
        typeof message !== "string" || !message.trim()
      ) {
        return reply.code(400).send({ error: "invalid_fields" });
      }

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        // Pas de clé configurée : on log le message et on renvoie OK
        app.log.warn({ name, email, subject, message }, "RESEND_API_KEY not set — message logged only");
        return reply.send({ ok: true });
      }

      const emailBody = [
        `De : ${String(name).trim() || "(non renseigné)"}`,
        `Email : ${email.trim()}`,
        "",
        message.trim()
      ].join("\n");

      // RESEND_FROM peut être défini dans Railway si le domaine n'est pas encore vérifié
      // Sinon utilise support@frontrush.net (nécessite que le domaine soit vérifié dans Resend)
      const from = process.env.RESEND_FROM ?? "FrontRush <support@frontrush.net>";

      const result = await resendSend(apiKey, {
        from,
        to       : ["support@frontrush.net"],
        reply_to : email.trim(),
        subject  : `[Support] ${subject.trim()}`,
        text     : emailBody
      });

      if (!result.ok) {
        app.log.error({ status: result.status, resendBody: result.body }, "Resend API error");
        // On inclut le détail de l'erreur Resend dans la réponse pour faciliter le debug
        return reply.code(502).send({
          error  : "email_send_failed",
          detail : result.body.slice(0, 300) // max 300 chars pour pas exposer trop
        });
      }

      return reply.send({ ok: true });

    } catch (err: any) {
      app.log.error({ err: String(err) }, "Support route unexpected error");
      return reply.code(500).send({ error: "internal_error" });
    }
  });
}
