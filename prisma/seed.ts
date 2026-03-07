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

async function main() {
  await prisma.doctor.deleteMany({});
  await prisma.doctor.createMany({ data: doctors });
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
