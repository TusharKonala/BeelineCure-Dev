-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'PAY_AT_CLINIC');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "paymentMethod" "PaymentMethod";
