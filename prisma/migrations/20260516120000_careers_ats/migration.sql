-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'REJECTED', 'HIRED');

-- CreateEnum
CREATE TYPE "AiRecommendation" AS ENUM ('SHORTLIST', 'REJECT');

-- AlterTable User (admin Google Calendar)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalendarAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalendarRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalendarAccessTokenExpiresAt" TIMESTAMP(3);

-- AlterTable JobApplication
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "resumeText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JobApplication" ALTER COLUMN "resumeUrl" DROP NOT NULL;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "aiScore" INTEGER;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "aiRecommendation" "AiRecommendation";

-- CreateTable InterviewRound
CREATE TABLE IF NOT EXISTS "InterviewRound" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "meetLink" TEXT,
    "confirmationToken" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "attendeeEmail" TEXT,
    "googleCalendarEventId" TEXT,
    "scheduledByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InterviewRound_confirmationToken_key" ON "InterviewRound"("confirmationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "InterviewRound_applicationId_roundNumber_key" ON "InterviewRound"("applicationId", "roundNumber");
CREATE INDEX IF NOT EXISTS "InterviewRound_confirmationToken_idx" ON "InterviewRound"("confirmationToken");
CREATE INDEX IF NOT EXISTS "JobApplication_status_createdAt_idx" ON "JobApplication"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "JobApplication_aiScore_createdAt_idx" ON "JobApplication"("aiScore", "createdAt" DESC);

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
