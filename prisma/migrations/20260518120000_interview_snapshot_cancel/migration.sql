-- AlterTable
ALTER TABLE "InterviewRound" ADD COLUMN "jobDescriptionSnapshot" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewRound" ADD COLUMN "cancelledAt" TIMESTAMP(3);
