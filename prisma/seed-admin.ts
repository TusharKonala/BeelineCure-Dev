import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPasswordPlain = process.env.ADMIN_SEED_PASSWORD;
  const adminName = process.env.ADMIN_SEED_NAME;

  if (!adminEmail || !adminPasswordPlain || !adminName) {
    throw new Error(
      "ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, and ADMIN_SEED_NAME are required.",
    );
  }

  const hashedPassword = await bcrypt.hash(adminPasswordPlain, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: UserRole.ADMIN,
      password: hashedPassword,
      profileComplete: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: adminEmail,
      name: adminName,
      role: UserRole.ADMIN,
      password: hashedPassword,
      profileComplete: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(
    `Admin seed complete for ${admin.email}. Role is set to ${admin.role}.`,
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
