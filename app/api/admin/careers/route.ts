import { NextResponse } from "next/server";

/** @deprecated Use /api/admin/careers/postings and /api/admin/careers/applications */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use /api/admin/careers/postings and /api/admin/careers/applications.",
    },
    { status: 410 },
  );
}
