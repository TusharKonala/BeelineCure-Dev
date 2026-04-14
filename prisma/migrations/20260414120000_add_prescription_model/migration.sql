-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "prescription";

-- CreateTable
CREATE TABLE "Prescription" (
    "appointmentId" TEXT NOT NULL,
    "medicines" JSONB NOT NULL,
    "generalNotes" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("appointmentId")
);

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
