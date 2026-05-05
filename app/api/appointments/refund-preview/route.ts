import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRefundPreviewForAppointment } from "@/lib/refund-preview";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appointmentId =
    request.nextUrl.searchParams.get("appointmentId")?.trim() ?? "";
  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId is required" },
      { status: 400 },
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      doctorId: true,
      consultationType: true,
      paymentStatus: true,
      stripePaymentId: true,
      stripePaymentIntentId: true,
      refundStatus: true,
      date: true,
      time: true,
      timezone: true,
      currencyAtBooking: true,
    },
  });

  if (!appointment) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }

  // Authorization: admins always allowed; doctors only for their own
  // appointments. Patients use the existing /api/cancel-appointment GET route.
  if (session.user.role === UserRole.DOCTOR) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!doctor || doctor.id !== appointment.doctorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const refundPreview = await getRefundPreviewForAppointment(appointment);

  return NextResponse.json({ refundPreview });
}
