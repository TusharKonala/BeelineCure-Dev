import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Link from "next/link";

type PageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  const rawSessionId = searchParams.session_id;
  const sessionId = Array.isArray(rawSessionId)
    ? rawSessionId[0]
    : rawSessionId;

  let doctorName = "Your doctor";
  let appointmentDate = "-";
  let appointmentTime = "-";
  let patientName = "-";
  let consultationTypeLabel = "Clinic visit";
  let hasDetails = false;

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const metadata = session.metadata ?? {};

      const doctorId = metadata.doctorId;
      if (doctorId) {
        const doctor = await prisma.doctor.findUnique({
          where: { id: doctorId },
        });
        if (doctor?.name) {
          doctorName = doctor.name;
        }
      }

      if (metadata.date) {
        appointmentDate = metadata.date;
      }

      if (metadata.time) {
        appointmentTime = metadata.time;
      }

      if (metadata.patientName) {
        patientName = metadata.patientName;
      }

      if (metadata.consultationType === "ONLINE") {
        consultationTypeLabel = "Online consultation";
      } else {
        consultationTypeLabel = "Clinic visit";
      }

      hasDetails = true;
    } catch {
      // If anything goes wrong, we simply fall back to the default placeholders.
      hasDetails = false;
    }
  }

  const confirmationMessage =
    consultationTypeLabel === "Online consultation"
      ? "Your online consultation has been confirmed. A confirmation email has been sent to your inbox."
      : "Your appointment has been confirmed. A confirmation email has been sent to your inbox. Please arrive a few minutes early.";

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Payment successful
            </h1>
            <p className="mt-3 font-montserrat text-sm text-[#5E5E5E] md:text-base">
              Payment successful.
            </p>
            <p className="mt-2 font-montserrat text-sm text-[#5E5E5E] md:text-base">
              {confirmationMessage}
            </p>
            {hasDetails ? (
              <div className="mt-6 space-y-3 font-montserrat text-sm">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <span className="font-medium text-[#111111]">Doctor</span>
                  <span className="text-[#333333] sm:text-right">
                    {doctorName}
                  </span>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <span className="font-medium text-[#111111]">
                    Appointment date
                  </span>
                  <span className="text-[#333333] sm:text-right">
                    {appointmentDate}
                  </span>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <span className="font-medium text-[#111111]">
                    Appointment time
                  </span>
                  <span className="text-[#333333] sm:text-right">
                    {appointmentTime}
                  </span>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <span className="font-medium text-[#111111]">Patient</span>
                  <span className="text-[#333333] sm:text-right">
                    {patientName}
                  </span>
                </div>
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <span className="font-medium text-[#111111]">
                    Consultation type
                  </span>
                  <span className="text-[#333333] sm:text-right">
                    {consultationTypeLabel}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-6 font-montserrat text-sm text-[#5E5E5E]">
                We could not load the full appointment details, but your payment
                was successful.
              </p>
            )}

            <div className="mt-8">
              <Button
                asChild
                className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
              >
                <Link href="/book-appointment">Book another appointment</Link>
              </Button>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
}
