-- Composite index for availability queries scoped by doctor, consultation mode, and day.
CREATE INDEX "DoctorAvailability_doctorId_consultationType_date_idx" ON "DoctorAvailability" ("doctorId", "consultationType", "date");
