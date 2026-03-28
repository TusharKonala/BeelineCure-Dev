-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "BookingSession" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
