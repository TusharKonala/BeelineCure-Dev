import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

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

const PATIENT_EMAIL = "tusharkonala284@gmail.com";

/** Sample HTML similar to output from common rich-text editors (headings, lists, emphasis). */
const RICH_PRESCRIPTIONS = [
  `<h3>Medications</h3>
<ul>
<li><strong>Paracetamol 650 mg</strong> — 1 tablet after food, twice daily for 3 days</li>
<li><em>ORS sachets</em> — 1 sachet in 200 ml water after each loose motion (max 6/day)</li>
</ul>
<p><strong>General advice</strong></p>
<p>Plenty of fluids; rest. Review if fever &gt; 101°F for more than 48 hours.</p>`,

  `<p><strong>Chief complaint:</strong> Allergic rhinitis</p>
<h3>Rx</h3>
<ol>
<li><strong>Cetirizine 10 mg</strong> — 1 tablet at bedtime for 5 nights</li>
<li><strong>Fluticasone nasal spray</strong> — 2 sprays per nostril once daily for 2 weeks</li>
</ol>
<p><em>Non-pharmacological:</em> Steam inhalation twice daily; avoid known triggers.</p>
<p>Follow-up: <u>2 weeks</u> or earlier if symptoms worsen.</p>`,

  `<h3>Musculoskeletal</h3>
<p><strong>Diclofenac gel 1%</strong></p>
<ul>
<li>Apply thin layer to affected knee, three times daily</li>
<li>Duration: 7 days</li>
</ul>
<p><strong>Activity modification</strong></p>
<p>Avoid high-impact exercise; gentle walking permitted. Ice pack 10 minutes after activity if sore.</p>
<p><em>Red flags:</em> sudden lock, swelling, or inability to bear weight — seek urgent care.</p>`,
];

async function main() {
  const today = toDateOnly(new Date());

  const doctors = await prisma.doctor.findMany({
    select: { id: true, name: true, timezone: true },
    orderBy: { name: "asc" },
  });

  if (doctors.length < 3) {
    console.error(
      `Need at least 3 doctors in DB, found ${doctors.length}. Run the main seed first.`,
    );
    process.exit(1);
  }

  const entries = [
    {
      doctor: doctors[0],
      date: addDays(today, -7),
      time: "10:00",
      consultationType: "CLINIC" as const,
      prescription: RICH_PRESCRIPTIONS[0],
    },
    {
      doctor: doctors[1],
      date: addDays(today, -12),
      time: "13:30",
      consultationType: "ONLINE" as const,
      prescription: RICH_PRESCRIPTIONS[1],
    },
    {
      doctor: doctors[2],
      date: addDays(today, -20),
      time: "09:30",
      consultationType: "CLINIC" as const,
      prescription: RICH_PRESCRIPTIONS[2],
    },
  ];

  for (const e of entries) {
    const existing = await prisma.appointment.findFirst({
      where: {
        doctorId: e.doctor.id,
        date: e.date,
        time: e.time,
        status: { not: "CANCELLED" },
      },
    });

    const data = {
      patientName: "Tushar Konala",
      email: PATIENT_EMAIL,
      phone: "+91 9999999999",
      timezone: e.doctor.timezone,
      patientTimezone: "Asia/Kolkata",
      consultationType: e.consultationType,
      status: "COMPLETED" as const,
      paymentStatus: "PAID" as const,
      prescription: e.prescription,
    };

    if (existing) {
      if (existing.email !== PATIENT_EMAIL) {
        console.warn(
          `Skip — slot in use by ${existing.email}: ${e.doctor.name} ${e.date.toISOString().slice(0, 10)} ${e.time}`,
        );
        continue;
      }
      await prisma.appointment.update({
        where: { id: existing.id },
        data,
      });
      console.log(
        `Updated prescription: ${e.doctor.name} | ${e.date.toISOString().slice(0, 10)} ${e.time}`,
      );
    } else {
      await prisma.appointment.create({
        data: {
          doctorId: e.doctor.id,
          date: e.date,
          time: e.time,
          ...data,
        },
      });
      console.log(
        `Created: ${e.doctor.name} | ${e.date.toISOString().slice(0, 10)} ${e.time}`,
      );
    }
  }

  console.log(
    `\nDone — 3 completed appointments with formatted prescriptions for ${PATIENT_EMAIL} (created or updated).`,
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
