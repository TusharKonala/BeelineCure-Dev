ALTER TABLE "Doctor"
ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Review"
ADD COLUMN "appointmentId" TEXT;

CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");
CREATE INDEX "Review_doctorId_createdAt_idx" ON "Review"("doctorId", "createdAt" DESC);

ALTER TABLE "Review"
ADD CONSTRAINT "Review_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Doctor" AS d
SET
  "averageRating" = COALESCE(stats."averageRating", 0),
  "reviewCount" = COALESCE(stats."reviewCount", 0)
FROM (
  SELECT
    "doctorId",
    AVG("rating")::double precision AS "averageRating",
    COUNT(*)::integer AS "reviewCount"
  FROM "Review"
  GROUP BY "doctorId"
) AS stats
WHERE d."id" = stats."doctorId";
