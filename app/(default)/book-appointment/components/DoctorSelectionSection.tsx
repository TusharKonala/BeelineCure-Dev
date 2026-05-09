"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDoctorDisplayName } from "@/lib/doctor-name";

async function getDoctors() {
  const res = await fetch("/api/doctors");
  if (!res.ok) throw new Error("Failed to fetch doctors");
  return res.json();
}

export function DoctorSelectionSection() {
  const {
    data: doctors = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["doctors"],
    queryFn: getDoctors,
  });

  return (
    <section className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <div className="flex flex-col gap-2 text-left md:text-left">
          <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Select a Doctor
          </h2>
        </div>

        {isLoading && (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm"
              >
                <Skeleton className="w-full rounded-t-2xl aspect-4/3 min-[450px]:h-72 min-[450px]:aspect-auto sm:h-64 bg-[#e5e5e5]" />
                <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                  <Skeleton className="h-6 w-32 md:h-7 bg-[#e5e5e5]" />
                  <Skeleton className="h-4 w-24 bg-[#e5e5e5]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-6 font-montserrat text-sm text-red-600">
            Failed to load doctors. Please try again.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {doctors.map(
              (doctor: {
                id: string;
                name: string;
                specialization: string;
                profilePhotoUrl: string;
              }) => (
                <Link
                  key={doctor.id}
                  href={`/book-appointment/${doctor.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2555F3] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 focus:ring-offset-2"
                >
                  <div className="relative w-full overflow-hidden rounded-t-2xl bg-[#f5f5f5] aspect-4/3 min-[450px]:h-72 min-[450px]:aspect-auto sm:h-64">
                    <Image
                      src={doctor.profilePhotoUrl}
                      alt={formatDoctorDisplayName(doctor.name)}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 px-5 py-4">
                    <span className="font-montaga text-lg text-[#111111] md:text-xl">
                      {formatDoctorDisplayName(doctor.name)}
                    </span>
                    <span className="font-montserrat text-sm text-[#5E5E5E]">
                      {doctor.specialization}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
