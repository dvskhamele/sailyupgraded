const trimEnvValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export function getEnv(...names: string[]) {
  for (const name of names) {
    const value = trimEnvValue(process.env[name]);
    if (value) return value;
  }
  return undefined;
}

export function requireEnv(primaryName: string, ...fallbackNames: string[]) {
  const value = getEnv(primaryName, ...fallbackNames);
  if (!value) {
    const allNames = [primaryName, ...fallbackNames].join(" or ");
    throw new Error(`${allNames} is not defined`);
  }
  return value;
}

export function getOpenAIApiKey() {
  return getEnv("OPENAI_API_KEY", "OPEN_AI_API_KEY", "OPENAI");
}

export function requireOpenAIApiKey() {
  return requireEnv("OPENAI_API_KEY", "OPEN_AI_API_KEY", "OPENAI");
}

export function getEmailFromAddress() {
  return getEnv("EMAIL_FROM", "RESEND_FROM_EMAIL", "RESEND_FROM");
}

export function requireEmailFromAddress() {
  return requireEnv("EMAIL_FROM", "RESEND_FROM_EMAIL", "RESEND_FROM");
}

export function getResendApiKey() {
  return getEnv("RESEND_API_KEY");
}

export function getStorageEndpoint() {
  return getEnv("MINIO_ENDPOINT", "CLOUDFLARE_S3_ENDPOINT");
}

export function getStoragePublicUrl() {
  return getEnv("NEXT_PUBLIC_MINIO_ENDPOINT", "MINIO_ENDPOINT", "CLOUDFLARE_S3_ENDPOINT");
}

export function getStorageAccessKey() {
  return getEnv("MINIO_ACCESS_KEY", "CLOUDFLARE_R2_ACCESSKEY_ID");
}

export function getStorageSecretKey() {
  return getEnv("MINIO_SECRET_KEY", "CLOUDFLARE_SECRET_ACCESS_KEY");
}

export function getStorageBucket() {
  return getEnv("MINIO_BUCKET", "CLOUDFLARE_R2_BUCKET", "R2_BUCKET");
}

export function getGoogleClientId() {
  return getEnv("GOOGLE_ID", "GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret() {
  return getEnv("GOOGLE_SECRET");
}
