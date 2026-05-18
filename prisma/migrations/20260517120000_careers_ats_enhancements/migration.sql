-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "salaryCurrency" TEXT;

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN "candidateTimezone" TEXT;

-- AlterTable
ALTER TABLE "InterviewRound" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "InterviewRound" ADD COLUMN "confirmationTokenExpiresAt" TIMESTAMP(3);
