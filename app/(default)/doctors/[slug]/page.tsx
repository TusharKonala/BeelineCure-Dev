import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AvailabilityConsultationType,
  type Prisma,
} from "@/generated/prisma/client";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import {
  coerceSupportedCurrency,
  type SupportedCurrency,
} from "@/lib/currency";
import { publicDoctorWhere } from "@/lib/doctor-visibility";
import { formatDoctorDisplayName } from "@/lib/doctor-name";
import { parsePriceMap } from "@/lib/doctor-pricing";
import { prisma } from "@/lib/db";
import { ProfileFees } from "./ProfileFees";

type PageProps = { params: Promise<{ slug: string }> };

function consultationModeLabel(types: AvailabilityConsultationType[]): string {
  let online = false;
  let clinic = false;
  for (const t of types) {
    if (t === AvailabilityConsultationType.ONLINE || t === AvailabilityConsultationType.BOTH)
      online = true;
    if (t === AvailabilityConsultationType.CLINIC || t === AvailabilityConsultationType.BOTH)
      clinic = true;
  }
  if (online && clinic) return "Online and in-clinic";
  if (online) return "Online consultation";
  if (clinic) return "In-clinic consultation";
  return "Consultation modes (set when slots are posted)";
}

function doctorBySlugWhere(slug: string): Prisma.DoctorWhereInput {
  return { AND: [publicDoctorWhere, { slug }] };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const doctor = await prisma.doctor.findFirst({
    where: doctorBySlugWhere(slug),
    select: {
      name: true,
      specialization: true,
    },
  });

  if (!doctor) {
    return { title: "Doctor not found · Clinivo" };
  }

  const displayName = formatDoctorDisplayName(doctor.name);
  const title = `${displayName} — ${doctor.specialization} · Clinivo`;
  const description = `Book an appointment with ${displayName}, ${doctor.specialization}.`;

  const urlPath = `/doctors/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: urlPath },
    openGraph: {
      title,
      description,
      url: urlPath,
    },
  };
}

export default async function DoctorPublicProfilePage(props: PageProps) {
  const { slug } = await props.params;

  const doctor = await prisma.doctor.findFirst({
    where: doctorBySlugWhere(slug),
    select: {
      id: true,
      name: true,
      specialization: true,
      qualification: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      consultationPriceCentsByDuration: true,
      currency: true,
    },
  });

  if (!doctor) notFound();

  const modes = await prisma.doctorAvailability.findMany({
    where: { doctorId: doctor.id },
    select: { consultationType: true },
    distinct: ["consultationType"],
  });

  const priceMap = parsePriceMap(doctor.consultationPriceCentsByDuration);
  const currency: SupportedCurrency = coerceSupportedCurrency(doctor.currency);

  const displayName = formatDoctorDisplayName(doctor.name);

  return (
    <main className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
          <div className="relative aspect-4/3 w-full max-h-80 bg-[#f5f5f5] md:aspect-21/9 md:max-h-none md:min-h-[240px]">
            <Image
              src={doctor.profilePhotoUrl}
              alt={displayName}
              fill
              sizes="100vw"
              className="object-cover object-top"
              priority
            />
          </div>

          <div className="flex flex-col gap-5 px-5 py-6 md:px-8 md:py-8">
            <div>
              <h1 className="font-montaga text-2xl text-[#111111] md:text-3xl">
                {displayName}
              </h1>
              <p className="mt-1 font-montserrat text-sm text-[#5e5e5e] md:text-base">
                {doctor.specialization}
              </p>
              <p className="mt-1 font-montserrat text-sm text-[#333333]">
                {doctor.qualification}
              </p>
              {doctor.yearsExperience != null && doctor.yearsExperience >= 0 && (
                <p className="mt-2 font-montserrat text-sm text-[#333333]">
                  {doctor.yearsExperience}{" "}
                  {doctor.yearsExperience === 1 ? "year" : "years"} of experience
                </p>
              )}
            </div>

            <div>
              <h2 className="font-montserrat text-xs font-semibold uppercase tracking-wide text-[#777777]">
                Consultation options
              </h2>
              <p className="mt-1 font-montserrat text-sm text-[#333333]">
                {consultationModeLabel(
                  modes.map((m) => m.consultationType),
                )}
              </p>
            </div>

            <ProfileFees priceMap={priceMap} doctorCurrency={currency} />

            {doctor.bio?.trim() && (
              <div>
                <h2 className="font-montserrat text-xs font-semibold uppercase tracking-wide text-[#777777]">
                  About
                </h2>
                <p className="mt-2 whitespace-pre-wrap font-montserrat text-sm leading-relaxed text-[#333333]">
                  {doctor.bio.trim()}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button className="rounded-full bg-[#2555F3] px-6 text-white hover:bg-[#1e44c7]" asChild>
                <Link href={`/book-appointment/${doctor.id}`}>Book Appointment</Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-[#cccccc]"
                asChild
              >
                <Link href="/book-appointment">Browse all doctors</Link>
              </Button>
            </div>
          </div>
        </article>
      </Container>
    </main>
  );
}
