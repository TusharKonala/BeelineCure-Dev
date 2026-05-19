-- Allow reusing a round number after the previous round with that number was cancelled.
DROP INDEX IF EXISTS "InterviewRound_applicationId_roundNumber_key";

CREATE UNIQUE INDEX "InterviewRound_applicationId_roundNumber_active_key"
ON "InterviewRound"("applicationId", "roundNumber")
WHERE "cancelledAt" IS NULL;
