import { prisma } from "@/lib/db";
import { publicDoctorWhere } from "@/lib/doctor-visibility";
import { NextResponse } from "next/server";

export async function GET() {
  const doctors = await prisma.doctor.findMany({
    where: publicDoctorWhere,
  });
  return NextResponse.json(doctors);
}
