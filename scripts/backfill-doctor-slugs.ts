/**
 * One-off: assign URLs for `/doctors/[slug]` where `slug` is null.
 * Targets active public-listed doctors (`userId` null catalog or approved accounts).
 *
 * Usage: `npx tsx scripts/backfill-doctor-slugs.ts` (with DATABASE_URL in env / .env)
 */
import "dotenv/config";
import { DoctorApprovalStatus } from "../generated/prisma/client.js";
import { assignUniqueDoctorSlug } from "../lib/doctor-slug";
import { prisma } from "../lib/db";

async function main() {
  const doctors = await prisma.doctor.findMany({
    where: {
      slug: null,
      isActive: true,
      OR: [{ userId: null }, { approvalStatus: DoctorApprovalStatus.APPROVED }],
    },
    select: { id: true, name: true },
  });

  for (const d of doctors) {
    await assignUniqueDoctorSlug(prisma, { doctorId: d.id, name: d.name });
    console.log(`slug → ${d.id} (${d.name})`);
  }

  console.log(`Done. Assigned ${doctors.length} slug(s).`);
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
