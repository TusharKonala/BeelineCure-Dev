-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "stripePaymentId" TEXT;
