import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import { ChatThreadView } from "@/components/chat/ChatThreadView";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function PatientChatThreadPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/chat");
  }

  const { appointmentId } = await params;

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/patient/chat"
          backLabel="All chats"
        />
      </Container>
    </div>
  );
}
