-- Add value to existing enum in Postgres
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'COMPLETED'
      AND enumtypid = '"AppointmentStatus"'::regtype
  ) THEN
    ALTER TYPE "AppointmentStatus" ADD VALUE 'COMPLETED';
  END IF;
END $$;

