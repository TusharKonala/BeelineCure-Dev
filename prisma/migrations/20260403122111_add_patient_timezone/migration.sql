-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "patientTimezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "BookingSession" ADD COLUMN     "patientTimezone" TEXT NOT NULL DEFAULT 'UTC';
