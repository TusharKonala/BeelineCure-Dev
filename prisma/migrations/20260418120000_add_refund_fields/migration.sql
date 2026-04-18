-- Add refund lifecycle tracking for online appointment refunds.

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_FAILED';

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN "stripePaymentIntentId" TEXT,
ADD COLUMN "stripeRefundId" TEXT,
ADD COLUMN "refundStatus" "RefundStatus",
ADD COLUMN "refundAmountCents" INTEGER;
