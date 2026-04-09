-- Add DOCTOR and ADMIN roles for auth flows
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DOCTOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- Doctor approval lifecycle enum
CREATE TYPE "DoctorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Doctor signup profile + approval state
CREATE TABLE "DoctorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "specialization" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "yearsExperience" INTEGER,
  "bio" TEXT,
  "profilePhotoUrl" TEXT NOT NULL,
  "approvalStatus" "DoctorApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

ALTER TABLE "DoctorProfile"
ADD CONSTRAINT "DoctorProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
