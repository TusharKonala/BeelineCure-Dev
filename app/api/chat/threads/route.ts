import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import {
  AppointmentStatus,
  ChatSenderRole,
  UserRole,
} from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  getUnreadCountsForUser,
  isChatLocked,
  lazyEnsureForPatient,
} from "@/lib/chat";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const email = session?.user?.email;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role === UserRole.PATIENT && email) {
    await lazyEnsureForPatient(userId, email);
  }

  const unread = await getUnreadCountsForUser(userId);

  if (role === UserRole.PATIENT && email) {
    const completedAppointments = await prisma.appointment.findMany({
      where: {
        email,
        status: AppointmentStatus.COMPLETED,
      },
      orderBy: [{ date: "desc" }, { time: "desc" }],
      select: {
        id: true,
        date: true,
        time: true,
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
            profilePhotoUrl: true,
          },
        },
        chatConversation: {
          select: {
            id: true,
            completedAt: true,
            lockedAt: true,
            twilioConversationSid: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, createdAt: true },
            },
          },
        },
      },
    });

    const threads = completedAppointments.map((apt) => {
      const conv = apt.chatConversation;
      const convId = conv?.id ?? `pending-${apt.id}`;
      return {
        id: convId,
        appointmentId: apt.id,
        peerName: apt.doctor.name,
        peerSubtitle: apt.doctor.specialization,
        peerPhotoUrl: apt.doctor.profilePhotoUrl,
        lastMessagePreview: conv?.messages[0]?.body ?? null,
        lastMessageAt: conv?.messages[0]?.createdAt?.toISOString() ?? null,
        unreadCount: conv ? (unread.byConversationId[conv.id] ?? 0) : 0,
        isReadOnly: conv
          ? isChatLocked(conv.completedAt, conv.lockedAt)
          : false,
        isReady: Boolean(conv?.twilioConversationSid),
      };
    });

    return NextResponse.json({ threads });
  }

  if (role === UserRole.DOCTOR) {
    const conversations = await prisma.chatConversation.findMany({
      where: {
        doctorUserId: userId,
        messages: { some: { senderRole: ChatSenderRole.PATIENT } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        appointmentId: true,
        completedAt: true,
        lockedAt: true,
        twilioConversationSid: true,
        appointment: {
          select: {
            patientName: true,
            date: true,
            time: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true },
        },
      },
    });

    const threads = conversations.map((c) => ({
      id: c.id,
      appointmentId: c.appointmentId,
      peerName: c.appointment.patientName,
      peerSubtitle: null,
      peerPhotoUrl: null,
      lastMessagePreview: c.messages[0]?.body ?? null,
      lastMessageAt: c.messages[0]?.createdAt?.toISOString() ?? null,
      unreadCount: unread.byConversationId[c.id] ?? 0,
      isReadOnly: isChatLocked(c.completedAt, c.lockedAt),
      isReady: Boolean(c.twilioConversationSid),
    }));

    return NextResponse.json({ threads });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
