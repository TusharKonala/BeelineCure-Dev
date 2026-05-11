import type { PrismaClient } from "@/generated/prisma/client";

type ReviewStatsClient = Pick<PrismaClient, "doctor" | "review">;

export type DoctorReviewStats = {
  averageRating: number;
  reviewCount: number;
};

export async function recomputeDoctorReviewStats(
  client: ReviewStatsClient,
  doctorId: string,
): Promise<DoctorReviewStats> {
  const stats = await client.review.aggregate({
    where: { doctorId },
    _avg: { rating: true },
    _count: { id: true },
  });
  const nextStats = {
    averageRating: stats._avg.rating ?? 0,
    reviewCount: stats._count.id,
  };

  await client.doctor.update({
    where: { id: doctorId },
    data: nextStats,
  });

  return nextStats;
}

export async function recomputeAllDoctorReviewStats(
  client: ReviewStatsClient,
): Promise<void> {
  const doctors = await client.doctor.findMany({
    select: { id: true },
  });

  for (const doctor of doctors) {
    await recomputeDoctorReviewStats(client, doctor.id);
  }
}
