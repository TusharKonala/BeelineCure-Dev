import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { recomputeAllDoctorReviewStats } from "../lib/review-stats";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

function toDateOnly(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return toDateOnly(out);
}

function hhmm(totalMinutes: number): string {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mins = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function buildRows(doctorId: string, date: Date) {
  const rows: {
    doctorId: string;
    date: Date;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    consultationType: "CLINIC" | "ONLINE" | "BOTH";
  }[] = [];

  const pushRange = (
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
    duration: 15 | 30 | 45 | 60,
    consultationType: "CLINIC" | "ONLINE" | "BOTH",
  ) => {
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    for (let minute = start; minute + duration <= end; minute += duration) {
      rows.push({
        doctorId,
        date,
        startTime: hhmm(minute),
        endTime: hhmm(minute + duration),
        slotDurationMinutes: duration,
        consultationType,
      });
    }
  };

  pushRange(9, 0, 11, 0, 15, "CLINIC");
  pushRange(12, 0, 14, 0, 30, "BOTH");
  pushRange(14, 0, 14, 45, 45, "BOTH");
  pushRange(16, 0, 18, 0, 60, "ONLINE");

  return rows;
}

async function main() {
  const doctors = await prisma.doctor.findMany({
    select: { id: true },
  });

  const daysToSeed = 365;
  const today = toDateOnly(new Date());

  await prisma.bookingSession.deleteMany({});
  const deletedAppointments = await prisma.appointment.deleteMany({});
  await recomputeAllDoctorReviewStats(prisma);
  await prisma.doctorAvailability.deleteMany({});

  for (const doctor of doctors) {
    const rowsForDoctor: {
      doctorId: string;
      date: Date;
      startTime: string;
      endTime: string;
      slotDurationMinutes: number;
      consultationType: "CLINIC" | "ONLINE" | "BOTH";
    }[] = [];
    for (let offset = 0; offset < daysToSeed; offset++) {
      const date = addDays(today, offset);
      rowsForDoctor.push(...buildRows(doctor.id, date));
    }
    await prisma.doctorAvailability.createMany({ data: rowsForDoctor });
  }

  const availabilityRowsCreated = await prisma.doctorAvailability.count();
  console.log(
    JSON.stringify(
      {
        doctors: doctors.length,
        daysSeeded: daysToSeed,
        deletedAppointments: deletedAppointments.count,
        availabilityRowsCreated,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
