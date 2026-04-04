import { prisma } from "@/lib/db";
import { AppointmentStatus } from "@/generated/prisma/client";
import { isDoctorTimeInPast } from "@/lib/timezone-display";

/**
 * Counts PENDING/CONFIRMED appointments whose start (date + time in doctor TZ) is still in the future.
 * Calendar-only comparisons miss same-day appointments that already passed.
 */
export async function countUpcomingAppointmentsForEmail(
  email: string,
): Promise<number> {
  const rows = await prisma.appointment.findMany({
    where: {
      email,
      status: {
        in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
      },
    },
    select: {
      date: true,
      time: true,
      timezone: true,
    },
  });

  return rows.filter((a) => {
    const dateStr = a.date.toISOString().slice(0, 10);
    return !isDoctorTimeInPast(dateStr, a.time, a.timezone);
  }).length;
}
