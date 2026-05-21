import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { assertConversationAccess, markRead } from "@/lib/chat";

export async function POST(
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

  await markRead(id, userId);
  return NextResponse.json({ ok: true });
}
