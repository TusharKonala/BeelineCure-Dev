import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { SignInForm } from "@/components/auth/SignInForm";

function SignInFormFallback() {
  return (
    <p className="font-montserrat text-sm text-[#5E5E5E] md:text-base">Loading…</p>
  );
}

export default function SignInPage() {
  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <Suspense fallback={<SignInFormFallback />}>
              <SignInForm />
            </Suspense>
          </div>
        </section>
      </Container>
    </div>
  );
}
