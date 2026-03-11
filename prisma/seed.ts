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
  // Clear dependent data that can block doctor resets
  await prisma.bookingSession.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.doctorAvailability.deleteMany({});

  // Reset doctors and seed base doctor data
  await prisma.doctor.deleteMany({});
  await prisma.doctor.createMany({ data: doctors });

  const allDoctors = await prisma.doctor.findMany();
  if (allDoctors.length === 0) return;

  const today = toDateOnly(new Date());
  const daysToSeed = 30;

  // Create availability slots for all doctors for the next 30 days
  for (const doctor of allDoctors) {
    for (let offset = 0; offset < daysToSeed; offset++) {
      const date = addDays(today, offset);

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
