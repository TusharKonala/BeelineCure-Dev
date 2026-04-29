import { Container } from "@/components/layout/Container";

export default function AdminDashboardPage() {
  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-3xl border border-[#e5e5e5] bg-white px-6 py-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:px-8">
          <h1 className="font-montserrat text-2xl font-semibold text-[#333333]">
            Admin Dashboard
          </h1>
          <p className="mt-2 max-w-2xl font-montserrat text-sm text-[#5e5e5e] md:text-base">
            Admin analytics and controls will be added in this section next.
          </p>
        </section>
      </Container>
    </div>
  );
}
