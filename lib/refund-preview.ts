import "server-only";

import { PaymentStatus } from "@/generated/prisma/client";
import { fromZonedTime } from "date-fns-tz";
import {
  cancellationRefundPolicy,
  getChargeAmountCents,
  resolvePaymentIntentId,
  type CancellationRefundPolicy,
  type RefundableAppointment,
} from "@/lib/refunds";

export type RefundPreview = {
  tier: CancellationRefundPolicy["tier"];
  percentage: CancellationRefundPolicy["percentage"];
  title: string;
  description: string;
  originalPaidAmountCents: number | null;
  eligibleRefundAmountCents: number | null;
  /** ISO 4217 currency code the original payment was charged in. */
  currency: string | null;
};

type AppointmentForRefundPreview = RefundableAppointment & {
  date: Date;
  time: string;
  timezone: string;
  currencyAtBooking: string | null;
};

/**
 * Computes the refund preview for an appointment: tier, percentage, original
 * paid amount, and eligible refund amount. Returns null when the appointment
 * isn't eligible for any refund (unpaid).
 */
export async function getRefundPreviewForAppointment(
  appointment: AppointmentForRefundPreview,
  nowMs = Date.now(),
): Promise<RefundPreview | null> {
  if (appointment.paymentStatus !== PaymentStatus.PAID) {
    return null;
  }

  const dateParam = appointment.date.toISOString().slice(0, 10);
  const timeWithSeconds =
    appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time;
  const appointmentStartMs = fromZonedTime(
    `${dateParam}T${timeWithSeconds}`,
    appointment.timezone,
  ).getTime();

  const policy = cancellationRefundPolicy(appointmentStartMs, nowMs);

  let originalPaidAmountCents: number | null = null;
  let eligibleRefundAmountCents: number | null = null;
  const paymentIntentId = await resolvePaymentIntentId(appointment);
  if (paymentIntentId) {
    originalPaidAmountCents = await getChargeAmountCents(paymentIntentId);
    if (originalPaidAmountCents) {
      eligibleRefundAmountCents = Math.floor(
        (originalPaidAmountCents * policy.percentage) / 100,
      );
    }
  }

  return {
    tier: policy.tier,
    percentage: policy.percentage,
    title: policy.title,
    description: policy.description,
    originalPaidAmountCents,
    eligibleRefundAmountCents,
    currency: appointment.currencyAtBooking ?? null,
  };
}
