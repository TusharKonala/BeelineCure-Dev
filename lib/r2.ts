import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGNED_PUT_EXPIRES_SECONDS = 300; // 5 minutes

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucketName() {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME!;
}

export async function createPresignedPut(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSignedUrl(client as any, command as any, {
    expiresIn: PRESIGNED_PUT_EXPIRES_SECONDS,
  });
}

export async function getR2Object(
  key: string,
): Promise<{ body: ReadableStream; contentType: string }> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  const response = await client.send(command);
  if (!response.Body) {
    throw new Error("Empty response body from R2");
  }
  const contentType = response.ContentType ?? "application/octet-stream";
  const body = response.Body.transformToWebStream() as ReadableStream;
  return { body, contentType };
}
