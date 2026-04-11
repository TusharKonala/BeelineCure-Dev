-- AlterTable: extend Doctor with profile / approval / user link
ALTER TABLE "Doctor" ADD COLUMN "userId" TEXT;
ALTER TABLE "Doctor" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "Doctor" ADD COLUMN "yearsExperience" INTEGER;
ALTER TABLE "Doctor" ADD COLUMN "bio" TEXT;
ALTER TABLE "Doctor" ADD COLUMN "profilePhotoUrl" TEXT;
ALTER TABLE "Doctor" ADD COLUMN "approvalStatus" "DoctorApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Doctor" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "Doctor" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing seeded doctors (no user account)
UPDATE "Doctor" SET "licenseNumber" = 'SEED' WHERE "licenseNumber" IS NULL;
ALTER TABLE "Doctor" ALTER COLUMN "licenseNumber" SET NOT NULL;

UPDATE "Doctor" SET "updatedAt" = "createdAt";

-- One Doctor row per former DoctorProfile (account-backed signup)
INSERT INTO "Doctor" (
    "id",
    "userId",
    "name",
    "specialization",
    "licenseNumber",
    "yearsExperience",
    "bio",
    "profilePhotoUrl",
    "image",
    "timezone",
    "approvalStatus",
    "approvedAt",
    "approvedByUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    dp."userId",
    COALESCE(NULLIF(trim(u."name"), ''), split_part(u."email", '@', 1)),
    dp."specialization",
    dp."licenseNumber",
    dp."yearsExperience",
    dp."bio",
    dp."profilePhotoUrl",
    COALESCE(NULLIF(trim(dp."profilePhotoUrl"), ''), '/doctors/sharma.jpg'),
    'UTC',
    dp."approvalStatus",
    dp."approvedAt",
    dp."approvedByUserId",
    dp."createdAt",
    dp."updatedAt"
FROM "DoctorProfile" dp
INNER JOIN "User" u ON u."id" = dp."userId";

-- Drop old profile table
DROP TABLE "DoctorProfile";

-- User <-> Doctor (optional account link)
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

ALTER TABLE "Doctor"
ADD CONSTRAINT "Doctor_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
