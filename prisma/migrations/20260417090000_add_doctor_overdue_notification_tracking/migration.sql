-- Track doctor dashboard activity for smarter overdue escalation.
ALTER TABLE "Doctor"
ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- Track overdue notification delivery state to avoid duplicates/spam.
ALTER TABLE "Appointment"
ADD COLUMN "overdueInAppNotifiedAt" TIMESTAMP(3),
ADD COLUMN "overdueEmailNotifiedAt" TIMESTAMP(3);

CREATE INDEX "Appointment_status_date_time_idx" ON "Appointment"("status", "date", "time");
