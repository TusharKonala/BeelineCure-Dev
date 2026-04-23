CREATE TYPE "AvailabilityConsultationType" AS ENUM ('CLINIC', 'ONLINE', 'BOTH');

ALTER TABLE "Doctor"
ADD COLUMN "consultationPriceCents" INTEGER NOT NULL DEFAULT 3000;

ALTER TABLE "DoctorAvailability"
ADD COLUMN "consultationType" "AvailabilityConsultationType" NOT NULL DEFAULT 'BOTH';
