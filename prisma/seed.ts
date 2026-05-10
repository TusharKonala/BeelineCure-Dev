import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../generated/prisma/client.js";
import { assignUniqueDoctorSlug } from "../lib/doctor-slug";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/** Local clock times for each doctor’s clinic day (interpreted in that doctor’s `timezone`). */
type DoctorSeed = {
  name: string;
  specialization: string;
  phone: string;
  qualification: string;
  profilePhotoUrl: string;
  timezone: string;
  /** One or more availability windows per calendar day. */
  dayBlocks: { startTime: string; endTime: string }[];
};

/** 9:00–13:00 local per doctor; slots API uses 30-minute steps. */
const dayBlock9to1 = [{ startTime: "09:00", endTime: "13:00" }] as const;

const doctorSeeds: DoctorSeed[] = [
  {
    name: "Dr. Sharma",
    specialization: "Cardiologist",
    phone: "+919876543210",
    qualification: "MBBS, MD (Cardiology)",
    profilePhotoUrl: "/doctors/sharma.jpg",
    timezone: "Asia/Kolkata",
    dayBlocks: [...dayBlock9to1],
  },
  {
    name: "Dr. Johnson",
    specialization: "General Physician",
    phone: "+12125550199",
    qualification: "MD",
    profilePhotoUrl: "/doctors/johnson.jpg",
    timezone: "America/New_York",
    dayBlocks: [...dayBlock9to1],
  },
  {
    name: "Dr. Fernandes",
    specialization: "Orthopedic Surgeon",
    phone: "+33144556677",
    qualification: "MD, Orthopedic Surgery",
    profilePhotoUrl: "/doctors/fernandes.jpg",
    timezone: "Europe/Paris",
    dayBlocks: [...dayBlock9to1],
  },
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
  // Order matters: children before parents where FKs exist.
  await prisma.bookingSession.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.doctorAvailability.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.user.deleteMany({});

  const today = toDateOnly(new Date());
  const daysToSeed = 365;

  for (const seed of doctorSeeds) {
    const doctor = await prisma.doctor.create({
      data: {
        name: seed.name,
        specialization: seed.specialization,
        phone: seed.phone,
        qualification: seed.qualification,
        licenseNumber: "SEED",
        profilePhotoUrl: seed.profilePhotoUrl,
        timezone: seed.timezone,
        isActive: true,
      },
    });

    await assignUniqueDoctorSlug(prisma, {
      doctorId: doctor.id,
      name: doctor.name,
    });

    for (let offset = 0; offset < daysToSeed; offset++) {
      const date = addDays(today, offset);

      for (const block of seed.dayBlocks) {
        await prisma.doctorAvailability.create({
          data: {
            doctorId: doctor.id,
            date,
            startTime: block.startTime,
            endTime: block.endTime,
            slotDurationMinutes: 30,
          },
        });
      }
    }
  }

  const adminEmail =
    process.env.ADMIN_SEED_EMAIL ?? "admin-local@clinivo.test";
  const adminPasswordPlain =
    process.env.ADMIN_SEED_PASSWORD ?? "ClinivoAdmin2026!";

  await prisma.user.create({
    data: {
      email: adminEmail,
      password: await bcrypt.hash(adminPasswordPlain, 12),
      name: "Local Admin",
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
      profileComplete: true,
    },
  });

  console.log(
    "Cleared all users, then seeded a local admin account (see below).",
  );

  console.log(
    `Seeded ${doctorSeeds.length} doctors: ${doctorSeeds.map((d) => `${d.name} (${d.timezone})`).join(", ")}`,
  );
  console.log(
    `Availability: ${daysToSeed} days, 9:00–13:00 local (30 min slots) per doctor.`,
  );
  console.log(
    `Admin: ${adminEmail} (set ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in .env to override; default password only for local dev).`,
  );
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
