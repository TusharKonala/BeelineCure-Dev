import { prisma } from "@/lib/db";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

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

  const doctor = await prisma.doctor.findUnique({
    where: { id: bookingSession.doctorId },
  });

  const details = [
    {
      label: "Doctor",
      value: doctor?.name ?? "Your doctor",
    },
    {
      label: "Consultation type",
      value:
        bookingSession.consultationType === "ONLINE"
          ? "Online consultation"
          : "Clinic visit",
    },
    {
      label: "Date",
      value: bookingSession.date || "-",
    },
    {
      label: "Time",
      value: bookingSession.time || "-",
    },
    {
      label: "Patient",
      value: bookingSession.patientName || "-",
    },
    {
      label: "Consultation price",
      value: "$30",
    },
  ];

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Review your booking
            </h1>
            <p className="mt-3 font-montserrat text-sm text-[#5E5E5E] md:text-base">
              Please confirm the details of your online consultation before
              proceeding to payment.
            </p>

            <div className="mt-6 space-y-4">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center"
                >
                  <span className="font-medium text-[#111111]">
                    {item.label}
                  </span>
                  <span className="text-[#5E5E5E] sm:text-right">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <form
              action="/api/checkout_sessions"
              method="POST"
              className="mt-8"
            >
              <Button
                type="submit"
                className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
              >
                Confirm &amp; Pay
              </Button>
            </form>
          </div>
        </section>
      </Container>
    </div>
  );
}

