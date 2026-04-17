import { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type CreateAppointmentNotificationInput = {
  patientEmail: string;
  type: NotificationType;
  title: string;
  message: string;
};

type CreateDoctorNotificationInput = {
  doctorId: string;
  type: NotificationType;
  title: string;
  message: string;
};

/**
 * Creates an in-app appointment notification for a patient identified by email.
 * No-op when the user account does not exist.
 */
export async function createAppointmentNotificationForEmail(
  input: CreateAppointmentNotificationInput,
) {
  const user = await prisma.user.findUnique({
    where: { email: input.patientEmail },
    select: { id: true },
  });
  if (!user) return;

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: input.type,
      title: input.title,
      message: input.message,
    },
  });
}

/**
 * Creates an in-app notification for a doctor identified by doctor profile id.
 * No-op when the doctor has no linked user account yet.
 */
export async function createDoctorNotificationForDoctorId(
  input: CreateDoctorNotificationInput,
) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: input.doctorId },
    select: { userId: true },
  });
  if (!doctor?.userId) return;

  await prisma.notification.create({
    data: {
      userId: doctor.userId,
      type: input.type,
      title: input.title,
      message: input.message,
    },
  });
}
