import { ChatThreadView } from "@/components/chat/ChatThreadView";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function DoctorChatThreadPage({ params }: PageProps) {
  const { appointmentId } = await params;

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden bg-[#fafafa] p-3 sm:p-4 lg:p-5">
      <div className="flex h-full min-h-0 w-full flex-col">
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/doctor/chat"
          backLabel="All chats"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
