-- Backfill isActive to match approval + account lifecycle, then default new rows to inactive.
UPDATE "Doctor"
SET "isActive" = true
WHERE "approvalStatus" = 'APPROVED' OR "userId" IS NULL;

UPDATE "Doctor"
SET "isActive" = false
WHERE "userId" IS NOT NULL
  AND "approvalStatus" IN ('PENDING', 'REJECTED');

ALTER TABLE "Doctor" ALTER COLUMN "isActive" SET DEFAULT false;
