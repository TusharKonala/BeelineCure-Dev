ALTER TABLE "DoctorAvailability"
ADD COLUMN "slotDurationMinutes" INTEGER NOT NULL DEFAULT 30;

UPDATE "DoctorAvailability" AS da
SET "slotDurationMinutes" = COALESCE(d."slotDurationMinutes", 30)
FROM "Doctor" AS d
WHERE da."doctorId" = d."id";
