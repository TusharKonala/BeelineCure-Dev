import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import { ChatThreadView } from "@/components/chat/ChatThreadView";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

const chatHeightClass =
  "h-[calc(100dvh-6.5rem)] md:h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-8rem)] w-full";

export default async function PatientChatThreadPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/chat");
  }

  const { appointmentId } = await params;

  return (
    <div className="w-full bg-[#fafafa] pb-6 -mb-8 md:mb-0 md:py-4 lg:py-6">
      <Container>
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/patient/chat"
          backLabel="All chats"
          className={chatHeightClass}
        />
      </Container>
    </div>
  );
}
