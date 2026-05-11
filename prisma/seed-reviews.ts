import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../generated/prisma/client.js";
import { recomputeAllDoctorReviewStats } from "../lib/review-stats";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const REVIEW_TEXTS = [
  "Very attentive and explained everything clearly. Would book again.",
  "Short wait time and thorough consultation. Recommended.",
  "Professional staff and calm environment. Exactly what I needed.",
  "Good diagnosis and follow-up plan. Satisfied overall.",
  "Clear communication and respectful care throughout the visit.",
  "Decent visit; could improve on bedside manner slightly.",
  "Excellent doctor, felt heard and cared for.",
  "Average experience; consultation felt a bit rushed.",
  "Outstanding clinic experience from check-in to follow-up.",
  "Helpful explanations and sensible treatment options.",
  "Not bad, clinical care was fine overall.",
  "Quick lab turnaround and actionable advice.",
  "Okay for a routine check-up, would prefer more discussion time.",
  "Very knowledgeable and answered every question patiently.",
  "Straightforward consultation; no wasted time.",
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const reviewCount = 15;
  const patientCount = 15;
  const patientPasswordHash = await bcrypt.hash("PatientSeed2026!", 12);

  const doctors = await prisma.doctor.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (doctors.length === 0) {
    throw new Error(
      "No doctors found. Create doctors first, then run db:seed:reviews.",
    );
  }

  for (let i = 1; i <= patientCount; i += 1) {
    const email = `patient-seed-${String(i).padStart(2, "0")}@clinivo.test`;
    await prisma.user.upsert({
      where: { email },
      update: {
        name: `Seed Patient ${i}`,
        role: UserRole.PATIENT,
        password: patientPasswordHash,
        profileComplete: true,
        emailVerifiedAt: new Date(),
      },
      create: {
        email,
        name: `Seed Patient ${i}`,
        role: UserRole.PATIENT,
        password: patientPasswordHash,
        profileComplete: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  const patients = await prisma.user.findMany({
    where: {
      role: UserRole.PATIENT,
      email: { contains: "patient-seed-", mode: "insensitive" },
    },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  if (patients.length === 0) {
    throw new Error("No seed patients available for review seeding.");
  }

  const reviewsData = Array.from({ length: reviewCount }, (_, index) => {
    const doctor = doctors[randomInt(0, doctors.length - 1)];
    const patient = patients[index % patients.length];
    const createdAt = new Date();
    createdAt.setUTCDate(createdAt.getUTCDate() - randomInt(1, 120));
    return {
      doctorId: doctor.id,
      patientId: patient.id,
      rating: randomInt(1, 5),
      comment: REVIEW_TEXTS[randomInt(0, REVIEW_TEXTS.length - 1)],
      createdAt,
    };
  });

  await prisma.review.createMany({ data: reviewsData });
  await recomputeAllDoctorReviewStats(prisma);

  console.log(
    `Inserted ${reviewCount} reviews without wiping existing data.`,
  );
  console.log(
    `Seed patients ensured: patient-seed-01@clinivo.test to patient-seed-${String(patientCount).padStart(2, "0")}@clinivo.test`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
