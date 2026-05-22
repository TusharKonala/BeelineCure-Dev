import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getPusherServer, userPrivateChannel } from "@/lib/pusher-server";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const allowedChannel = userPrivateChannel(userId);
  if (channelName !== allowedChannel) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pusher = getPusherServer();
    const auth = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (err) {
    console.error("[pusher/auth] authorize failed:", err);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
