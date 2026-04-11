-- Use profilePhotoUrl as the single photo field; backfill from legacy `image` where needed
UPDATE "Doctor"
SET "profilePhotoUrl" = "image"
WHERE "profilePhotoUrl" IS NULL OR btrim("profilePhotoUrl") = '';

ALTER TABLE "Doctor" DROP COLUMN "image";

ALTER TABLE "Doctor" ALTER COLUMN "profilePhotoUrl" SET NOT NULL;
