-- Drop full unique index (blocked rebooking after cancel — cancelled rows still counted).
DROP INDEX IF EXISTS "Appointment_doctorId_date_time_key";

-- At most one non-cancelled appointment per doctor/date/time (allows multiple cancelled history rows).
CREATE UNIQUE INDEX "Appointment_doctorId_date_time_active_key"
ON "Appointment"("doctorId", "date", "time")
WHERE "status" <> 'CANCELLED'::"AppointmentStatus";
