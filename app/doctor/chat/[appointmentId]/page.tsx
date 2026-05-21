import { Container } from "@/components/layout/Container";
import { ChatThreadView } from "@/components/chat/ChatThreadView";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function DoctorChatThreadPage({ params }: PageProps) {
  const { appointmentId } = await params;

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/doctor/chat"
          backLabel="All chats"
        />
      </Container>
    </div>
  );
}
