-- Add currency column to Doctor (ISO 4217, 3 letters, uppercase). Default USD
-- preserves existing semantics where prices were displayed and charged in USD.
ALTER TABLE "Doctor"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

-- Add per-duration price map. Default seeds the four allowed slot durations
-- (15/30/45/60) with proportional prices (1500/3000/4500/6000 cents).
ALTER TABLE "Doctor"
ADD COLUMN "consultationPriceCentsByDuration" JSONB NOT NULL DEFAULT '{"15":1500,"30":3000,"45":4500,"60":6000}'::jsonb;

-- Backfill the per-duration map from each doctor's existing flat price.
-- The 30-minute price equals the legacy value; other durations scale linearly
-- (15 = 0.5x, 45 = 1.5x, 60 = 2x).
UPDATE "Doctor"
SET "consultationPriceCentsByDuration" = jsonb_build_object(
  '15', GREATEST(1, ROUND("consultationPriceCents" * 0.5)::int),
  '30', "consultationPriceCents",
  '45', GREATEST(1, ROUND("consultationPriceCents" * 1.5)::int),
  '60', GREATEST(1, ROUND("consultationPriceCents" * 2.0)::int)
);

-- Drop the legacy flat-price column once data has been migrated.
ALTER TABLE "Doctor"
DROP COLUMN "consultationPriceCents";

-- Snapshot price + currency on BookingSession so the price the patient was
-- shown and paid is immutable, even if the doctor later edits their map.
ALTER TABLE "BookingSession"
ADD COLUMN "priceCentsAtBooking" INTEGER,
ADD COLUMN "currencyAtBooking" TEXT;
