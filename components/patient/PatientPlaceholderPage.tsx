import { Container } from "@/components/layout/Container";

export function PatientPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1
            style={{
              WebkitTextStroke: "0.08px #333333",
              WebkitTextFillColor: "#333333",
            }}
            className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl"
          >
            {title}
          </h1>
        </section>
      </Container>
    </div>
  );
}
