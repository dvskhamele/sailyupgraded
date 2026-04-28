import { S3Client } from "@aws-sdk/client-s3";

let cachedMinioClient: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

export function getMinioClient(): S3Client {
  if (cachedMinioClient) {
    return cachedMinioClient;
  }

  cachedMinioClient = new S3Client({
    endpoint: requireEnv("MINIO_ENDPOINT"),
    region: "us-east-1",
    credentials: {
      accessKeyId: requireEnv("MINIO_ACCESS_KEY"),
      secretAccessKey: requireEnv("MINIO_SECRET_KEY"),
    },
    forcePathStyle: true,
  });

  return cachedMinioClient;
}

export function getMinioBucket(): string {
  return requireEnv("MINIO_BUCKET");
}

export function getMinioPublicUrl(): string {
  return requireEnv("NEXT_PUBLIC_MINIO_ENDPOINT");
}
