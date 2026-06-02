-- Make googleId nullable (to support Discord-only accounts)
ALTER TABLE "User" ALTER COLUMN "googleId" DROP NOT NULL;

-- Add discordId
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
