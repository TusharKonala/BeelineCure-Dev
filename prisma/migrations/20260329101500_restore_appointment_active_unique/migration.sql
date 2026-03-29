-- Restores partial unique index removed incidentally when Prisma reconciled drift in add_user_auth.
-- At most one non-cancelled appointment per doctor/date/time.
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_doctorId_date_time_active_key"
ON "Appointment"("doctorId", "date", "time")
WHERE "status" <> 'CANCELLED'::"AppointmentStatus";
