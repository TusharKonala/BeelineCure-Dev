-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "emailChangeTokenHash" TEXT,
ADD COLUMN     "emailChangeTokenExpiresAt" TIMESTAMP(3);
