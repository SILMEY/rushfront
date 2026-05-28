import { OAuth2Client } from "google-auth-library";
import { prisma } from "../prisma/client.js";

export function createGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUrl = process.env.GOOGLE_REDIRECT_URL;
  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error("google_oauth_not_configured");
  }
  return new OAuth2Client(clientId, clientSecret, redirectUrl);
}

export async function upsertUserFromGoogle(params: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}) {
  const { googleId, email, name, avatarUrl } = params;
  return prisma.user.upsert({
    where: { googleId },
    update: { email, name, avatarUrl: avatarUrl ?? undefined },
    create: { googleId, email, name, avatarUrl: avatarUrl ?? undefined }
  });
}
