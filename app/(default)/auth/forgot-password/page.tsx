import { Container } from "@/components/layout/Container";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <ForgotPasswordForm />
          </div>
        </section>
      </Container>
    </div>
  );
}

