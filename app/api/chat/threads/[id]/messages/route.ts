import { getServerSession } from "next-auth/next";
import { after, NextRequest, NextResponse } from "next/server";
import { ChatSenderRole, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  assertConversationAccess,
  fetchOlderMessagesForConversation,
  fetchRecentMessagesForConversation,
  linkPatientUserOnConversation,
  markRead,
  scheduleChatMessagePush,
  sendChatMessage,
} from "@/lib/chat";
import { notifyChatInboxAfterMessage } from "@/lib/chat-inbox-notify";
import { triggerNewChatMessage } from "@/lib/pusher-server";

export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const conversation = await assertConversationAccess(id, userId, role);

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const beforeRaw = request.nextUrl.searchParams.get("before")?.trim();
  if (beforeRaw) {
    const before = new Date(beforeRaw);
    if (Number.isNaN(before.getTime())) {
      return NextResponse.json({ error: "Invalid before cursor" }, { status: 400 });
    }
    const page = await fetchOlderMessagesForConversation(id, userId, before);
    return NextResponse.json(page);
  }

  const page = await fetchRecentMessagesForConversation(id, userId);
  const response = NextResponse.json(page);

  after(async () => {
    await markRead(id, userId);
  });

  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const body = (await request.json().catch(() => null)) as {
    body?: unknown;
  } | null;

  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 4000) {
    return NextResponse.json(
      { error: "Message body is required (max 4000 characters)" },
      { status: 400 },
    );
  }

  const senderRole =
    role === UserRole.DOCTOR ? ChatSenderRole.DOCTOR : ChatSenderRole.PATIENT;

  try {
    const { message, conversation: conv, linkPatientUserId } =
      await sendChatMessage({
        conversationId: id,
        userId,
        role,
        userEmail: session?.user?.email ?? null,
        senderRole,
        body: text,
      });

    const response = NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        senderUserId: message.senderUserId,
        senderRole: message.senderRole,
        isOwn: true,
        createdAt: message.createdAt.toISOString(),
      },
    });

    after(async () => {
      const results = await Promise.allSettled([
        markRead(conv.id, userId),
        ...(linkPatientUserId
          ? [linkPatientUserOnConversation(conv.id, userId)]
          : []),
        triggerNewChatMessage(conv.id, {
          id: message.id,
          body: message.body,
          senderUserId: message.senderUserId,
          senderRole: message.senderRole,
          createdAt: message.createdAt.toISOString(),
        }),
        notifyChatInboxAfterMessage({
          conversationId: conv.id,
          appointmentId: conv.appointmentId,
          senderUserId: userId,
          senderRole,
          messageBody: message.body,
          messageCreatedAt: message.createdAt,
        }),
        scheduleChatMessagePush({
          message,
          conversation: conv,
          senderRole,
        }),
      ]);

      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[chat/messages] Background delivery failed:", result.reason);
        }
      }
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    if (msg.includes("read-only")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[chat/messages] Send failed:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
