import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/Container";

const doctors = [
  {
    id: "sharma",
    name: "Dr. Sharma",
    specialization: "Cardiologist",
    image: "/doctor-cardiologist.jpg",
  },
  {
    id: "johnson",
    name: "Dr. Johnson",
    specialization: "General Physician",
    image: "/doctor-physician.jpg",
  },
  {
    id: "fernandes",
    name: "Dr. Fernandes",
    specialization: "Orthopedic",
    image: "/doctor-orthopedic.jpg",
  },
];

export function DoctorSelectionSection() {
  return (
    <section className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <div className="flex flex-col gap-2 text-left md:text-left">
          <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Select a Doctor
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {doctors.map((doctor) => (
            <Link
              key={doctor.id}
              href={`/book-appointment/${doctor.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2555F3] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 focus:ring-offset-2"
            >
              <div className="relative w-full overflow-hidden rounded-t-2xl bg-[#f5f5f5] aspect-[4/3] min-[450px]:h-72 min-[450px]:aspect-auto sm:h-64">
                <Image
                  src={doctor.image}
                  alt={doctor.name}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 px-5 py-4">
                <span className="font-montaga text-lg text-[#111111] md:text-xl">
                  {doctor.name}
                </span>
                <span className="font-montserrat text-sm text-[#5E5E5E]">
                  {doctor.specialization}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
