import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url(),
  // In dev/compose we allow booting without Google OAuth configured;
  // auth endpoints will return an explicit error until configured.
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URL: z.string().optional().default(""),
  DATABASE_URL: z.string().min(1),
  COOKIE_DOMAIN: z.string().optional().default("")
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
