import { prisma } from "@/lib/db";
import { AppointmentStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  const { appointmentId, token } = parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || !appointment.cancelToken || appointment.cancelToken !== token) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ status: "already_cancelled" as const });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: AppointmentStatus.CANCELLED },
  });

  return NextResponse.json({ status: "success" as const });
}

