import { S3Client } from "@aws-sdk/client-s3";
import {
  getStorageAccessKey,
  getStorageBucket,
  getStorageEndpoint,
  getStoragePublicUrl,
  getStorageSecretKey,
  requireEnv,
} from "@/lib/env";

let cachedMinioClient: S3Client | null = null;

export function getMinioClient(): S3Client {
  if (cachedMinioClient) {
    return cachedMinioClient;
  }

  const endpoint = getStorageEndpoint();
  const accessKeyId = getStorageAccessKey();
  const secretAccessKey = getStorageSecretKey();

  cachedMinioClient = new S3Client({
    endpoint: endpoint ?? requireEnv("MINIO_ENDPOINT", "CLOUDFLARE_S3_ENDPOINT"),
    region: "us-east-1",
    credentials: {
      accessKeyId:
        accessKeyId ?? requireEnv("MINIO_ACCESS_KEY", "CLOUDFLARE_R2_ACCESSKEY_ID"),
      secretAccessKey:
        secretAccessKey ??
        requireEnv("MINIO_SECRET_KEY", "CLOUDFLARE_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });

  return cachedMinioClient;
}

export function getMinioBucket(): string {
  return getStorageBucket() ?? requireEnv("MINIO_BUCKET", "CLOUDFLARE_R2_BUCKET", "R2_BUCKET");
}

export function getMinioPublicUrl(): string {
  return (
    getStoragePublicUrl() ??
    requireEnv("NEXT_PUBLIC_MINIO_ENDPOINT", "MINIO_ENDPOINT", "CLOUDFLARE_S3_ENDPOINT")
  );
}
