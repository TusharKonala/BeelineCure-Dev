-- AlterTable
ALTER TABLE "HealthProfile" ADD COLUMN "heightCm" DOUBLE PRECISION;
ALTER TABLE "HealthProfile" ADD COLUMN "weightKg" DOUBLE PRECISION;
ALTER TABLE "HealthProfile" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "HealthProfile" ADD COLUMN "gender" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "currentMedications" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "pastSurgeries" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "smokingStatus" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "alcoholUse" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "activityLevel" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "emergencyContact2Name" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "emergencyContact2Phone" TEXT;
ALTER TABLE "HealthProfile" ADD COLUMN "emergencyContact2Relationship" TEXT;
