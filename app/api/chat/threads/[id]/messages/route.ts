import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { ChatSenderRole, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  assertConversationAccess,
  markRead,
  sendChatMessage,
} from "@/lib/chat";
import { prisma } from "@/lib/db";
import { triggerNewChatMessage } from "@/lib/pusher-server";
import { twilioUserIdentity } from "@/lib/twilio";

export async function GET(
  _request: NextRequest,
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

  const dbMessages = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      twilioMessageSid: true,
      senderUserId: true,
      senderRole: true,
      body: true,
      createdAt: true,
    },
  });

  await markRead(id, userId);

  const messages = dbMessages.map((m) => ({
    id: m.id,
    sid: m.twilioMessageSid,
    body: m.body,
    senderUserId: m.senderUserId,
    senderRole: m.senderRole,
    isOwn: m.senderUserId === userId,
    authorIdentity: twilioUserIdentity(m.senderUserId),
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({ messages });
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
  const conversation = await assertConversationAccess(id, userId, role);

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
    const message = await sendChatMessage({
      conversationId: id,
      senderUserId: userId,
      senderRole,
      body: text,
    });

    try {
      await triggerNewChatMessage(id, {
        id: message.id,
        body: message.body,
        senderUserId: message.senderUserId,
        senderRole: message.senderRole,
        createdAt: message.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("[chat/messages] Pusher trigger failed:", err);
    }

    return NextResponse.json({
      message: {
        id: message.id,
        sid: message.twilioMessageSid,
        body: message.body,
        senderUserId: message.senderUserId,
        senderRole: message.senderRole,
        isOwn: true,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    if (msg.includes("read-only")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not ready")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("[chat/messages] Send failed:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
