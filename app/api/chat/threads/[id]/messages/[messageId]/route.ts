import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { deleteChatMessage, type DeleteMessageScope } from "@/lib/chat";
import { triggerMessageDeleted } from "@/lib/pusher-server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId, messageId } = await context.params;

  const body = (await request.json().catch(() => null)) as {
    scope?: unknown;
  } | null;

  const scope = body?.scope;
  if (scope !== "everyone" && scope !== "me") {
    return NextResponse.json(
      { error: 'scope must be "everyone" or "me"' },
      { status: 400 },
    );
  }

  try {
    const result = await deleteChatMessage({
      conversationId,
      messageId,
      userId,
      role,
      scope: scope as DeleteMessageScope,
    });

    if (result.broadcastEveryone) {
      try {
        await triggerMessageDeleted(conversationId, {
          id: messageId,
          isDeletedForEveryone: true,
        });
      } catch (err) {
        console.error("[chat/message-delete] Pusher failed:", err);
      }
    }

    if (scope === "me") {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: result.message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("Forbidden")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("15 minutes")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[chat/message-delete] Failed:", err);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
