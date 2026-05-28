import { randomUUID } from "crypto";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { assertConversationAccess } from "@/lib/chat";
import { createPresignedPut } from "@/lib/r2";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getExtFromContentType(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: string; contentType?: string; fileSize?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const conversationId = body.conversationId?.trim();
  const contentType = body.contentType?.trim().toLowerCase();
  const fileSize = Number(body.fileSize);

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 },
    );
  }
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "contentType must be image/jpeg, image/png, or image/webp" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "fileSize must be a positive number up to 10MB" },
      { status: 400 },
    );
  }

  const conversation = await assertConversationAccess(
    conversationId,
    userId,
    role,
  );
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found or access denied" },
      { status: 403 },
    );
  }

  const ext = getExtFromContentType(contentType);
  const key = `chat-images/${conversationId}/${randomUUID()}.${ext}`;

  const uploadUrl = await createPresignedPut(key, contentType, fileSize);

  return NextResponse.json({ uploadUrl, key });
}
