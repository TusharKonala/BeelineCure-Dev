import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { assertConversationAccess } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { getR2Object } from "@/lib/r2";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ messageId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { messageId } = await context.params;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: {
      messageType: true,
      imageKey: true,
      conversationId: true,
    },
  });

  if (!message || message.messageType !== "image" || !message.imageKey) {
    return new Response("Not found", { status: 404 });
  }

  const conversation = await assertConversationAccess(
    message.conversationId,
    userId,
    role,
  );
  if (!conversation) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { body, contentType } = await getR2Object(message.imageKey);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Image not found", { status: 404 });
  }
}
