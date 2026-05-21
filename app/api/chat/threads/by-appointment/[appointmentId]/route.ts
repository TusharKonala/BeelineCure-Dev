import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  assertConversationAccess,
  ensureChatConversationForAppointment,
  isChatLocked,
  lazyEnsureForPatient,
  markRead,
} from "@/lib/chat";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const email = session?.user?.email;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appointmentId } = await context.params;

  if (role === UserRole.PATIENT && email) {
    await lazyEnsureForPatient(userId, email);
  }

  let conversation = await prisma.chatConversation.findUnique({
    where: { appointmentId },
    include: {
      appointment: {
        select: {
          id: true,
          email: true,
          patientName: true,
          doctor: { select: { name: true, userId: true } },
        },
      },
    },
  });

  if (!conversation && role === UserRole.PATIENT) {
    const apt = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        email: email ?? "",
        status: AppointmentStatus.COMPLETED,
      },
      select: { id: true },
    });
    if (apt) {
      await ensureChatConversationForAppointment(apt.id);
      conversation = await prisma.chatConversation.findUnique({
        where: { appointmentId },
        include: {
          appointment: {
            select: {
              id: true,
              email: true,
              patientName: true,
              doctor: { select: { name: true, userId: true } },
            },
          },
        },
      });
    }
  }

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await assertConversationAccess(conversation.id, userId, role);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markRead(conversation.id, userId);

  const peerName =
    role === UserRole.DOCTOR
      ? conversation.appointment.patientName
      : conversation.appointment.doctor.name;

  return NextResponse.json({
    thread: {
      id: conversation.id,
      appointmentId: conversation.appointmentId,
      peerName,
      isReadOnly: isChatLocked(conversation.completedAt, conversation.lockedAt),
      isReady: Boolean(conversation.twilioConversationSid),
      completedAt: conversation.completedAt.toISOString(),
      lockedAt: conversation.lockedAt?.toISOString() ?? null,
    },
  });
}
