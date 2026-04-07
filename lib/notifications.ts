import { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type CreateAppointmentNotificationInput = {
  patientEmail: string;
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
