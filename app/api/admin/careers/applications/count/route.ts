import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import {
  buildJobApplicationWhereInput,
  parseApplicationsListParams,
} from "@/lib/careers-applications-query";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = parseApplicationsListParams(request.nextUrl.searchParams);
  const where = buildJobApplicationWhereInput(params);
  const count = await prisma.jobApplication.count({ where });

  return NextResponse.json({ count });
}
