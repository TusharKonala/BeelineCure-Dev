import { Container } from "@/components/layout/Container";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const initialRole = params.role === "doctor" ? "DOCTOR" : "PATIENT";

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <SignUpForm initialRole={initialRole} />
          </div>
        </section>
      </Container>
    </div>
  );
}
