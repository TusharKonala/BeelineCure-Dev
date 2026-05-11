import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AppointmentStatus,
  UserRole,
  type Prisma,
} from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recomputeDoctorReviewStats } from "@/lib/review-stats";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const patientId = session?.user?.id;
  if (!email || !patientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.PATIENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { appointmentId } = await context.params;
  if (!appointmentId) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a 1-5 star rating and a comment under 1000 characters." },
      { status: 400 },
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      doctorId: true,
      email: true,
      status: true,
      review: {
        select: { id: true },
      },
    },
  });

  if (!appointment || appointment.email !== email) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.status !== AppointmentStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Only completed appointments can be reviewed." },
      { status: 409 },
    );
  }
  if (appointment.review) {
    return NextResponse.json(
      { error: "This appointment has already been reviewed." },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          appointmentId: appointment.id,
          patientId,
          doctorId: appointment.doctorId,
          rating: parsed.data.rating,
          comment: parsed.data.comment,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      });
      const doctorStats = await recomputeDoctorReviewStats(tx, appointment.doctorId);
      return { review, doctorStats };
    });

    return NextResponse.json({
      review: {
        ...result.review,
        createdAt: result.review.createdAt.toISOString(),
      },
      doctorStats: result.doctorStats,
    });
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "This appointment has already been reviewed." },
        { status: 409 },
      );
    }
    throw error;
  }
}
