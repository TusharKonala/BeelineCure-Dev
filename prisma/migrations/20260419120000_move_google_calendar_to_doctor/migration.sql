-- AlterTable
ALTER TABLE "User"
  DROP COLUMN "googleCalendarAccessToken",
  DROP COLUMN "googleCalendarRefreshToken",
  DROP COLUMN "googleCalendarAccessTokenExpiresAt";

-- AlterTable
ALTER TABLE "Doctor"
  ADD COLUMN "googleCalendarAccessToken" TEXT,
  ADD COLUMN "googleCalendarRefreshToken" TEXT,
  ADD COLUMN "googleCalendarAccessTokenExpiresAt" TIMESTAMP(3);
