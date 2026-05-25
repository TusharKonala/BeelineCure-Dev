import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
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
    <div className="flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden bg-[#fafafa] p-3 sm:p-4 lg:p-5">
      <div className="flex h-full min-h-0 w-full flex-col">
        <ChatThreadView
          appointmentId={appointmentId}
          backHref="/patient/chat"
          backLabel="All chats"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
