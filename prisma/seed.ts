import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const doctors = [
  { name: "Dr. Sharma", specialization: "Cardiologist", image: "/doctors/sharma.jpg" },
  { name: "Dr. Johnson", specialization: "General Physician", image: "/doctors/johnson.jpg" },
  { name: "Dr. Fernandes", specialization: "Orthopedic", image: "/doctors/fernandes.jpg" },
];

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

async function main() {
  await prisma.doctor.deleteMany({});
  await prisma.doctor.createMany({ data: doctors });

  const doctor = await prisma.doctor.findFirst();
  if (!doctor) return;

  const today = toDateOnly(new Date());
  const availabilityDates = [today, addDays(today, 1), addDays(today, 2)];

  for (const date of availabilityDates) {
    const existing = await prisma.doctorAvailability.findFirst({
      where: { doctorId: doctor.id, date },
    });
    if (!existing) {
      await prisma.doctorAvailability.create({
        data: {
          doctorId: doctor.id,
          date,
          startTime: "09:00",
          endTime: "13:00",
        },
      });
    }
  }

  const appointmentSlots = [
    { time: "10:00", patientName: "Jane Doe", email: "jane.doe@example.com", phone: "+1 555-0100" },
    { time: "11:30", patientName: "John Smith", email: "john.smith@example.com", phone: "+1 555-0101" },
  ];

  for (const slot of appointmentSlots) {
    await prisma.appointment.upsert({
      where: {
        doctorId_date_time: {
          doctorId: doctor.id,
          date: today,
          time: slot.time,
        },
      },
      create: {
        doctorId: doctor.id,
        date: today,
        time: slot.time,
        patientName: slot.patientName,
        email: slot.email,
        phone: slot.phone,
        consultationType: "CLINIC",
        status: "CONFIRMED",
      },
      update: {},
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
