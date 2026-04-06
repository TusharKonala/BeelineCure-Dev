-- Restores indexes dropped by migration 20260406064509_add_health_profile (drift).
CREATE INDEX IF NOT EXISTS "User_emailVerificationTokenHash_idx" ON "User"("emailVerificationTokenHash");
CREATE INDEX IF NOT EXISTS "User_magicLinkTokenHash_idx" ON "User"("magicLinkTokenHash");
CREATE INDEX IF NOT EXISTS "User_passwordResetTokenHash_idx" ON "User"("passwordResetTokenHash");

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_doctorId_date_time_active_key"
ON "Appointment"("doctorId", "date", "time")
WHERE "status" <> 'CANCELLED'::"AppointmentStatus";
