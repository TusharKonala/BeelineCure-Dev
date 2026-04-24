import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
import { Container } from "@/components/layout/Container";
import { ConfirmAndPayButton } from "@/components/booking/ConfirmAndPayButton";
import { notFound } from "next/navigation";
import { BookingSessionStatus } from "@/generated/prisma/client";
import { ExpiredBookingSession } from "./ExpiredBookingSession";
import { PatientLocalDateTime } from "./PatientLocalDateTime";

type PageProps = {
  params: Promise<{ bookingSessionId: string }>;
};

export default async function BookingReviewPage({ params }: PageProps) {
  const { bookingSessionId } = await params;

  const bookingSession = await prisma.bookingSession.findUnique({
    where: { id: bookingSessionId },
  });

  if (!bookingSession) {
    notFound();
  }

  const doctor = await prisma.doctor.findFirst({
    where: publicDoctorByIdWhere(bookingSession.doctorId),
  });

  if (!doctor) {
    notFound();
  }
  const consultationPriceLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((doctor.consultationPriceCents ?? 3000) / 100);

  // Time comparison is server-only; expiresAt is authoritative for checkout TTL (10 min).
  const isExpired =
    bookingSession.status === BookingSessionStatus.EXPIRED ||
    bookingSession.expiresAt <= new Date();

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            {isExpired ? (
              <ExpiredBookingSession doctorId={bookingSession.doctorId} />
            ) : (
              <>
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Review your booking
            </h1>
            <p className="mt-3 font-montserrat text-sm text-[#5E5E5E] md:text-base">
              Please confirm the details of your online consultation before
              proceeding to payment.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
                <span className="font-medium text-[#111111]">Doctor</span>
                <span className="text-[#5E5E5E] sm:text-right">
                  {doctor.name}
                </span>
              </div>
              <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
                <span className="font-medium text-[#111111]">
                  Consultation type
                </span>
                <span className="text-[#5E5E5E] sm:text-right">
                  {bookingSession.consultationType === "ONLINE"
                    ? "Online consultation"
                    : "Clinic visit"}
                </span>
              </div>

              <PatientLocalDateTime
                date={bookingSession.date}
                time={bookingSession.time}
                doctorTimezone={bookingSession.timezone}
              />

              <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
                <span className="font-medium text-[#111111]">Patient</span>
                <span className="text-[#5E5E5E] sm:text-right">
                  {bookingSession.patientName || "-"}
                </span>
              </div>
              <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
                <span className="font-medium text-[#111111]">Duration</span>
                <span className="text-[#5E5E5E] sm:text-right">
                  {bookingSession.durationMinutes} minutes
                </span>
              </div>
              <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
                <span className="font-medium text-[#111111]">
                  Consultation price
                </span>
                <span className="text-[#5E5E5E] sm:text-right">
                  {consultationPriceLabel}
                </span>
              </div>
            </div>

            {bookingSession.consultationType === "ONLINE" && (
              <div className="mt-6 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4">
                <p className="font-montserrat text-sm font-semibold text-[#111111]">
                  Cancellation & refund policy
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 font-montserrat text-sm text-[#5E5E5E]">
                  <li>
                    Cancel 24 or more hours before your appointment for a full
                    refund.
                  </li>
                  <li>
                    Cancel within 24 hours of your appointment for a 50% refund.
                  </li>
                  <li>
                    If the doctor cancels or is unavailable, you receive a full
                    refund.
                  </li>
                  <li>No-shows are not eligible for a refund.</li>
                </ul>
                <p className="mt-2 font-montserrat text-xs text-[#5E5E5E]">
                  Refunds are issued to your original payment method and
                  typically arrive within 5-10 business days.
                </p>
              </div>
            )}

            <ConfirmAndPayButton
              bookingSessionId={bookingSessionId}
              doctorId={bookingSession.doctorId}
            />
              </>
            )}
          </div>
        </section>
      </Container>
    </div>
  );
}

