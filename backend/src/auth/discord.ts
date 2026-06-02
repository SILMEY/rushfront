import { prisma } from "../prisma/client.js";

function cfg() {
  const clientId     = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUrl  = process.env.DISCORD_REDIRECT_URL;
  if (!clientId)     throw new Error("discord_missing_CLIENT_ID");
  if (!clientSecret) throw new Error("discord_missing_CLIENT_SECRET");
  if (!redirectUrl)  throw new Error("discord_missing_REDIRECT_URL");
  return { clientId, clientSecret, redirectUrl };
}

export function discordAuthUrl(): string {
  const { clientId, redirectUrl } = cfg();
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUrl,
    response_type: "code",
    scope:         "identify email"
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

export async function exchangeDiscordCode(code: string) {
  const { clientId, clientSecret, redirectUrl } = cfg();

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "authorization_code",
      code,
      redirect_uri:  redirectUrl
    })
  });

  const tokens = (await tokenRes.json()) as any;
  if (!tokens.access_token) throw new Error("discord_token_exchange_failed");

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  const user = (await userRes.json()) as any;
  if (!user.id) throw new Error("discord_user_fetch_failed");

  return {
    discordId: String(user.id),
    email:     String(user.email ?? `${user.id}@discord.invalid`),
    name:      String(user.global_name ?? user.username ?? user.id),
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null
  };
}

export async function upsertUserFromDiscord(params: {
  discordId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}) {
  const { discordId, email, name, avatarUrl } = params;
  return prisma.user.upsert({
    where:  { discordId },
    update: { email, name, avatarUrl: avatarUrl ?? undefined },
    create: { discordId, email, name, avatarUrl: avatarUrl ?? undefined }
  });
}
