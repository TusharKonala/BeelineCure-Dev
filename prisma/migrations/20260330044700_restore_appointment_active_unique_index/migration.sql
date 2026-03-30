-- Restores partial unique index removed incidentally by Prisma drift (see prior migrations).
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_doctorId_date_time_active_key"
ON "Appointment"("doctorId", "date", "time")
WHERE "status" <> 'CANCELLED'::"AppointmentStatus";
