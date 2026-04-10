import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function getExtension(contentType: string, fallbackName: string): string {
  const fromType = contentType.split("/")[1]?.toLowerCase();
  if (fromType && fromType !== "jpeg") return fromType;
  if (fromType === "jpeg") return "jpg";
  const fromName = fallbackName.split(".").pop()?.toLowerCase();
  return fromName && fromName.length <= 5 ? fromName : "jpg";
}

function getS3Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export async function POST(request: Request) {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    return NextResponse.json(
      { error: "R2 upload is not configured" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Image must be 5MB or less" },
      { status: 400 },
    );
  }

  const ext = getExtension(file.type, file.name);
  const key = `doctor-profiles/${Date.now()}-${randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const normalizedPublicUrl = publicUrl.replace(/\/+$/, "");
  return NextResponse.json({ url: `${normalizedPublicUrl}/${key}` });
}
