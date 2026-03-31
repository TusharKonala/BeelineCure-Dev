-- AlterTable
ALTER TABLE "User" ADD COLUMN "magicLinkTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "magicLinkTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "magicLinkLastSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_magicLinkTokenHash_idx" ON "User"("magicLinkTokenHash");
