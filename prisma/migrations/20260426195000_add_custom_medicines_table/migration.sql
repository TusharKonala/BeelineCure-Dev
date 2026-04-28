CREATE TABLE "custom_medicines" (
    "id" TEXT NOT NULL, 
    "name" TEXT NOT NULL,
    "created_by_doctor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_medicines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_medicines_created_by_doctor_id_created_at_idx"
    ON "custom_medicines"("created_by_doctor_id", "created_at" DESC);

ALTER TABLE "custom_medicines"
    ADD CONSTRAINT "custom_medicines_created_by_doctor_id_fkey"
    FOREIGN KEY ("created_by_doctor_id")
    REFERENCES "Doctor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
