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
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-[#fafafa] py-4 md:py-6">
      <Container className="flex h-full min-h-0 !max-w-[min(100%,90rem)] flex-col px-4 md:px-6">
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/patient/chat"
          backLabel="All chats"
          className="h-full"
        />
      </Container>
    </div>
  );
}
