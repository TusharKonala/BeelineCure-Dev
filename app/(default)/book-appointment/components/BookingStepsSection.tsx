import { Container } from "@/components/layout/Container";

const bookingSteps = [
  { number: "1", label: "Choose a doctor" },
  { number: "2", label: "Select a date" },
  { number: "3", label: "Pick a time" },
  { number: "4", label: "Confirm your appointment" },
];

export function BookingStepsSection() {
  return (
    <section className="w-full bg-white py-10 md:py-14 lg:py-16">
      <Container>
        <div className="text-center">
          <h2 className="font-montaga text-2xl leading-tight text-[#111111] md:text-3xl">
            How booking works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-montserrat text-sm leading-relaxed text-[#5E5E5E] md:mt-4 md:text-base">
            Complete your appointment in just a few simple steps.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {bookingSteps.map((step) => (
            <div
              key={step.number}
              className="flex flex-col items-center rounded-2xl border border-[#e5e5e5] bg-white px-5 py-6 text-center shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#2555F3]/10 font-montserrat text-sm font-semibold text-[#2555F3]">
                {step.number}
              </div>
              <p className="font-montserrat text-sm text-[#111111] md:text-base">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

