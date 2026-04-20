ALTER TABLE "Appointment"
ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "BookingSession"
ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30;

UPDATE "Appointment" AS a
SET "durationMinutes" = COALESCE(d."slotDurationMinutes", 30)
FROM "Doctor" AS d
WHERE a."doctorId" = d."id";

UPDATE "BookingSession" AS bs
SET "durationMinutes" = COALESCE(d."slotDurationMinutes", 30)
FROM "Doctor" AS d
WHERE bs."doctorId" = d."id";
