UPDATE "DoctorProfile"
SET "profilePhotoUrl" = '/doctor-placeholder.png'
WHERE "profilePhotoUrl" IS NULL;

ALTER TABLE "DoctorProfile"
ALTER COLUMN "profilePhotoUrl" SET NOT NULL;
