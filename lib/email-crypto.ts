import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.EMAIL_ENCRYPTION_KEY;
  console.log("[getKey] EMAIL_ENCRYPTION_KEY present:", !!raw);
  if (raw) {
    console.log("[getKey] Key length:", raw.length);
  }
  
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  
  return Buffer.from(raw, "hex");
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns base64(iv [12 bytes] + authTag [16 bytes] + ciphertext)
 */
export function encrypt(plaintext: string): string {
  console.log("[encrypt] Called with plaintext (length):", plaintext.length);
  const key = getKey();
  
  const iv = crypto.randomBytes(IV_BYTES);
  console.log("[encrypt] IV generated (length):", iv.length);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  console.log("[encrypt] Ciphertext generated (length):", encrypted.length);
  
  const authTag = cipher.getAuthTag();
  console.log("[encrypt] Auth tag generated (length):", authTag.length);
  
  const finalBuffer = Buffer.concat([iv, authTag, encrypted]);
  console.log("[encrypt] Final buffer (length):", finalBuffer.length);
  
  const base64Result = finalBuffer.toString("base64");
  console.log("[encrypt] Final base64 (length):", base64Result.length);
  
  return base64Result;
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  console.log("[decrypt] Called with ciphertext:", ciphertext);
  console.log("[decrypt] Ciphertext length (bytes after base64 decode?):", ciphertext.length);
  
  const key = getKey();
  
  const buf = Buffer.from(ciphertext, "base64");
  console.log("[decrypt] Decoded buffer length:", buf.length);
  console.log("[decrypt] Required minimum buffer length:", IV_BYTES + AUTH_TAG_BYTES + 1);
  
  if (buf.length < IV_BYTES + AUTH_TAG_BYTES) {
    console.error("[decrypt] ERROR: Buffer too short!");
    throw new Error("Invalid ciphertext: buffer too short");
  }
  
  const iv = buf.subarray(0, IV_BYTES);
  console.log("[decrypt] IV extracted (length):", iv.length);
  
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  console.log("[decrypt] Auth tag extracted (length):", authTag.length);
  
  const encrypted = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  console.log("[decrypt] Encrypted part extracted (length):", encrypted.length);
  
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const result = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    console.log("[decrypt] Decryption SUCCESS! Result length:", result.length);
    return result;
  } catch (e) {
    console.error("[decrypt] ERROR in decryption:", e);
    throw e;
  }
}
