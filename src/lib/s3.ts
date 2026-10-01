import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requiredEnv } from "./env";

let client: S3Client | undefined;

function s3() {
  client ??= new S3Client({
    endpoint: requiredEnv("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: requiredEnv("S3_ACCESS_KEY"), secretAccessKey: requiredEnv("S3_SECRET_KEY") },
  });
  return client;
}

const bucket = () => requiredEnv("S3_BUCKET");

/**
 * Adds the optional S3_FOLDER prefix (to share a bucket with other apps). Only applied here:
 * the rest of the app, the database and image URLs all use unprefixed keys like "shows/x.avif".
 */
export function withFolder(key: string, folder = process.env.S3_FOLDER ?? ""): string {
  const prefix = folder.replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/${key}` : key;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: withFolder(key), Body: body, ContentType: contentType }));
}

export async function getObject(key: string) {
  return s3().send(new GetObjectCommand({ Bucket: bucket(), Key: withFolder(key) }));
}

export async function ensureBucket() {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket() }));
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode !== 404) throw err;
    await s3().send(new CreateBucketCommand({ Bucket: bucket() }));
  }
}
