-- AlterTable
ALTER TABLE "User" ADD COLUMN "pseudo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_pseudo_key" ON "User"("pseudo");

