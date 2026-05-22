import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import { ChatListClient } from "@/components/chat/ChatListClient";

export default async function PatientChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/chat");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-montaga text-2xl font-semibold text-[#333333] md:text-3xl">
            Chat
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
            Message doctors from your completed appointments.
          </p>
          <div className="mt-6">
            <ChatListClient basePath="/patient/chat" />
          </div>
        </section>
      </Container>
    </div>
  );
}
