-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleCalendarAccessToken" TEXT,
ADD COLUMN "googleCalendarRefreshToken" TEXT,
ADD COLUMN "googleCalendarAccessTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "googleMeetUrl" TEXT,
ADD COLUMN "googleCalendarEventId" TEXT;
