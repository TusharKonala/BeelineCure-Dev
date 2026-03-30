-- DropIndex
DROP INDEX "Appointment_doctorId_date_time_active_key";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
