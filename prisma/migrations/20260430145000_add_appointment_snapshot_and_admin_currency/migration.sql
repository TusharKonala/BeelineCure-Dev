ALTER TABLE "Appointment"
    ADD COLUMN "priceCentsAtBooking" INTEGER,
    ADD COLUMN "currencyAtBooking" TEXT;

ALTER TABLE "User"
    ADD COLUMN "preferredCurrency" TEXT;
