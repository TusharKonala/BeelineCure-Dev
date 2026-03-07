import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const doctors = await prisma.doctor.findMany();
  return NextResponse.json(doctors);
}
