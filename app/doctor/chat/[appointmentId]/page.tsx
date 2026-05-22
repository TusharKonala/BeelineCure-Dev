import { Container } from "@/components/layout/Container";
import { ChatThreadView } from "@/components/chat/ChatThreadView";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function DoctorChatThreadPage({ params }: PageProps) {
  const { appointmentId } = await params;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-[#fafafa] py-4 md:py-6">
      <Container className="flex h-full min-h-0 flex-col">
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/doctor/chat"
          backLabel="All chats"
          className="h-full"
        />
      </Container>
    </div>
  );
}
