import { Container } from "@/components/layout/Container";

export default function PatientDashboardPage() {
  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Patient dashboard
          </h1>
        </section>
      </Container>
    </div>
  );
}
