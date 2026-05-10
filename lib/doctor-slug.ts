import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Produce a URL-safe slug fragment from doctor display/store name:
 * lowercase, hyphenated; strips "Dr." and non-ASCII punctuation.
 */
export function slugBaseFromDoctorName(name: string): string {
  const withoutTitle = name
    .trim()
    .replace(/^dr\.?\s+/i, "")
    .trim();
  const nfkd = withoutTitle.normalize("NFKD");
  const ascii = nfkd.replace(/\p{M}/gu, "");
  const lower = ascii.toLowerCase();
  const collapsed = lower
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return collapsed.length > 0 ? collapsed : "doctor";
}

type ClientSlice = Pick<PrismaClient, "doctor">;

/**
 * Persist a unique slug for `doctorId` derived from `name`. Appends `-2`, `-3`, … on collision.
 */
export async function assignUniqueDoctorSlug(
  prisma: ClientSlice,
  options: { doctorId: string; name: string },
): Promise<string> {
  const base = slugBaseFromDoctorName(options.name);
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.doctor.findFirst({
      where: {
        slug,
        id: { not: options.doctorId },
      },
      select: { id: true },
    });
    if (!taken) {
      await prisma.doctor.update({
        where: { id: options.doctorId },
        data: { slug },
      });
      return slug;
    }
  }
  throw new Error("Unable to assign a unique doctor slug");
}
