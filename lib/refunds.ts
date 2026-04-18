import "server-only";

import {
  ConsultationType,
  PaymentStatus,
  RefundStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * Minimal shape of an Appointment row that the refund helpers need.
 * We accept this projection so callers can `select` only what's required.
 */
export type RefundableAppointment = {
  id: string;
  consultationType: ConsultationType;
  paymentStatus: PaymentStatus;
  stripePaymentId: string | null;
  stripePaymentIntentId: string | null;
  refundStatus: RefundStatus | null;
};

/**
 * Return the cached PaymentIntent id, or retrieve it from the stored
 * checkout session (cs_xxx) and persist it back onto the appointment
 * so subsequent calls don't re-hit Stripe.
 */
export async function resolvePaymentIntentId(
  appointment: RefundableAppointment,
): Promise<string | null> {
  if (appointment.stripePaymentIntentId) {
    return appointment.stripePaymentIntentId;
  }
  if (!appointment.stripePaymentId) {
    return null;
  }

  const session = await stripe.checkout.sessions.retrieve(
    appointment.stripePaymentId,
  );
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (!paymentIntentId) return null;

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { stripePaymentIntentId: paymentIntentId },
  });

  return paymentIntentId;
}

/**
 * Fetch the amount actually charged (in cents) for a payment intent,
 * so 50% refunds stay correct even if pricing changes later.
 */
export async function getChargeAmountCents(
  paymentIntentId: string,
): Promise<number | null> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return paymentIntent.amount_received || paymentIntent.amount || null;
}

export type InitiateRefundResult =
  | {
      ok: true;
      refundAmountCents: number;
      percentage: 100 | 50;
    }
  | {
      ok: false;
      reason:
        | "not_online"
        | "not_paid"
        | "already_refunded"
        | "missing_payment_intent"
        | "missing_amount"
        | "stripe_error";
      error?: unknown;
    };

type InitiateRefundInput = {
  appointment: RefundableAppointment;
  percentage: 100 | 50;
};

/**
 * Creates a Stripe refund for an online, paid appointment and records
 * the refund lifecycle state on the appointment row.
 *
 * Guards:
 *   - Only ONLINE appointments are eligible (clinic appointments never refund).
 *   - Only PAID appointments can be refunded.
 *   - A refund is only initiated once (refundStatus must be null).
 */
export async function initiateRefund({
  appointment,
  percentage,
}: InitiateRefundInput): Promise<InitiateRefundResult> {
  if (appointment.consultationType !== ConsultationType.ONLINE) {
    return { ok: false, reason: "not_online" };
  }
  if (appointment.paymentStatus !== PaymentStatus.PAID) {
    return { ok: false, reason: "not_paid" };
  }
  if (appointment.refundStatus !== null) {
    return { ok: false, reason: "already_refunded" };
  }

  const paymentIntentId = await resolvePaymentIntentId(appointment);
  if (!paymentIntentId) {
    return { ok: false, reason: "missing_payment_intent" };
  }

  let refundAmountCents: number | undefined;
  if (percentage === 50) {
    const chargeCents = await getChargeAmountCents(paymentIntentId);
    if (!chargeCents) {
      return { ok: false, reason: "missing_amount" };
    }
    refundAmountCents = Math.floor(chargeCents / 2);
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(refundAmountCents !== undefined
        ? { amount: refundAmountCents }
        : {}),
      metadata: {
        appointmentId: appointment.id,
        refundPercentage: String(percentage),
      },
    });

    const persistedAmount =
      refundAmountCents ?? refund.amount ?? 0;

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        stripeRefundId: refund.id,
        refundStatus: RefundStatus.PENDING,
        refundAmountCents: persistedAmount,
      },
    });

    return {
      ok: true,
      refundAmountCents: persistedAmount,
      percentage,
    };
  } catch (err) {
    console.error(
      "[refunds] stripe.refunds.create failed for appointment",
      appointment.id,
      err,
    );
    return { ok: false, reason: "stripe_error", error: err };
  }
}

/**
 * Human-readable refund sentence appended to cancellation emails
 * (patient and doctor flows). Returns null when no refund applies.
 */
export function refundEmailSentence(result: InitiateRefundResult): string | null {
  if (!result.ok) return null;
  const dollars = (result.refundAmountCents / 100).toFixed(2);
  if (result.percentage === 100) {
    return `A full refund of $${dollars} has been initiated and should appear on your original payment method within 5-10 business days.`;
  }
  return `Per our cancellation policy, a 50% refund of $${dollars} has been initiated and should appear on your original payment method within 5-10 business days.`;
}
