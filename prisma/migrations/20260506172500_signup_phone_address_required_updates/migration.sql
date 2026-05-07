-- Add optional patient profile contact fields.
ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "address" TEXT;

-- Backfill required doctor fields for legacy rows before enforcing NOT NULL.
UPDATE "Doctor"
SET "phone" = COALESCE(NULLIF(TRIM("phone"), ''), '+10000000000');

UPDATE "Doctor"
SET "qualification" = COALESCE(NULLIF(TRIM("qualification"), ''), 'Not specified');

ALTER TABLE "Doctor"
  ALTER COLUMN "phone" SET NOT NULL,
  ALTER COLUMN "qualification" SET NOT NULL;
