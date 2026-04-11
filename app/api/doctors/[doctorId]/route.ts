import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  const { doctorId } = await params;
  const doctor = await prisma.doctor.findFirst({
    where: publicDoctorByIdWhere(doctorId),
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }
  return NextResponse.json(doctor);
}
