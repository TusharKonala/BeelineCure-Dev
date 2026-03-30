-- Treat existing credentials users as verified so the new verification flow
-- doesn't lock them out. New signups will still start unverified.
UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL
  AND "password" IS NOT NULL;

